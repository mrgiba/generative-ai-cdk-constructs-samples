#
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
# with the License. A copy of the License is located at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
# OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
# and limitations under the License.
#

import os

from aws_cdk import (
    aws_dynamodb as dynamodb,
    aws_lambda as lambda_,
    aws_s3 as s3,
    aws_s3_notifications as s3n,
    Duration,
    Stack,
)
from constructs import Construct
from cdk_nag import NagSuppressions, NagPackSuppression


from .stack_constructs import (
    AgentCoreConstruct,
    ServerAccessLogsBucketConstruct,
    BucketConstruct,
    TableConstruct,
    APIConstruct,
    PythonFunctionConstruct,
)

class InferenceStack(Stack):

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        faq_knowledge_base_id: str,
        docs_knowledge_base_id: str,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        self.inference_logging_bucket = ServerAccessLogsBucketConstruct(
            self,
            "InferenceLoggingBucket",
        )

        self.inference_bucket = BucketConstruct(
            self,
            "InferenceBucket",
            server_access_logs_bucket=self.inference_logging_bucket,
            cors=[
                s3.CorsRule(
                allowed_methods= [s3.HttpMethods.GET, s3.HttpMethods.PUT],
                allowed_origins=['http://localhost:5173'],
                allowed_headers=['*']
            )],
        )

        # Question Set Processiong Job DynamoDB table
        self.jobs_table = TableConstruct(
            self,
            "JobsTable",
            partition_key=dynamodb.Attribute(
                name="job_id", type=dynamodb.AttributeType.STRING
            ),
        )

        self.jobs_table.add_global_secondary_index(
           partition_key=dynamodb.Attribute(name='job_id', type=dynamodb.AttributeType.STRING),
           sort_key=dynamodb.Attribute(name='updated_at', type=dynamodb.AttributeType.STRING),
           index_name='UpdatedAtSecondaryIndex')

        self.agent = AgentCoreConstruct(
            self,
            "RFPAnsweringAgent",
            region=Stack.of(self).region,
            faq_knowledge_base_id=faq_knowledge_base_id,
            docs_knowledge_base_id=docs_knowledge_base_id,
            jobs_table=self.jobs_table,
        )

        self.start_job_fn = PythonFunctionConstruct(
            self,
            "StartJobFunction",
            entry=os.path.join(
                os.path.dirname(__file__), "lambdas", "start_job_fn"
            ),
            index="index.py",
            handler="handler",
            runtime=lambda_.Runtime.PYTHON_3_14,
            timeout=Duration.minutes(1),
            environment={
                "LOG_LEVEL": "INFO",
                "AGENT_RUNTIME_ARN": self.agent.runtime.agent_runtime_arn
            },
        )

        self.inference_bucket.add_event_notification(
            s3.EventType.OBJECT_CREATED_PUT,
            s3n.LambdaDestination(self.start_job_fn),
            s3.NotificationKeyFilter(prefix="inference/", suffix=".xlsx"),
        )

        self.inference_bucket.grant_read_write(self.agent.agent_exec_role)
        self.jobs_table.grant_read_write_data(self.agent.agent_exec_role)
        self.agent.runtime.grant_invoke(self.start_job_fn.role)
        self.agent.runtime.grant_invoke_runtime(self.start_job_fn.role)

        self.api = APIConstruct(
            self,
            "APIConstruct",
            self.region,
            self.inference_bucket,
            self.jobs_table,
        )

        self.template_options.description='Description: (uksb-1tupboc43) (tag:rfp-answer-generation)'

        NagSuppressions.add_resource_suppressions(
            construct=self.start_job_fn.role,
            suppressions=[
                NagPackSuppression(
                    id="AwsSolutions-IAM5",
                    reason="Wildcard used to support multiple runtime versions.",
                    applies_to=[
                        "Resource::<RFPAnsweringAgentRFPAgentRuntime032828F4.AgentRuntimeArn>/*"
                    ]
                ),
            ],
            apply_to_children=True,
        )

        NagSuppressions.add_resource_suppressions_by_path(
            stack=self,
            path=f"/{Stack.of(self).stack_name}/BucketNotificationsHandler050a0587b7544547bf325f094a3db834/Role/Resource",
            suppressions=[
                NagPackSuppression(
                    id="AwsSolutions-IAM4",
                    reason="CDK Bucket Notifications Handler uses the AWSLambdaBasicExecutionRole AWS Managed Policy. Managed by CDK.",
                ),
                NagPackSuppression(
                    id="AwsSolutions-IAM5",
                    reason="CDK Bucket Notifications Handler needs to support non-standardized object naming.",
                ),
            ],
            apply_to_children=True,
        )
