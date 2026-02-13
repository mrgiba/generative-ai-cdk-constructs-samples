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
    aws_bedrock_agentcore_alpha as agentcore,
    aws_dynamodb as dynamodb,
    aws_ecr_assets as ecr_assets,
    aws_iam as iam,
    Stack,
    # Names,
)

from constructs import Construct
from cdk_nag import NagSuppressions, NagPackSuppression

class AgentCoreConstruct(Construct):
    def __init__(
        self,
        scope: Construct,
        id: str,
        region: str,
        faq_knowledge_base_id: str,
        docs_knowledge_base_id: str,
        jobs_table: dynamodb.Table,
        **kwargs,
    ):
        super().__init__(scope, id, **kwargs)

        self.artifact = ecr_assets.DockerImageAsset(
            self,
            "AgentImage",
            directory=os.path.join(os.path.dirname(__file__), "..", "agent"),
            file="Dockerfile",
            platform=ecr_assets.Platform.LINUX_ARM64,
        )

        self.agent_runtime_artifact = agentcore.AgentRuntimeArtifact.from_ecr_repository(
            repository=self.artifact.repository, tag=self.artifact.image_tag
        )
        
        self.agent_exec_role = iam.Role(
            self,
            "RFPAgentExecutionRole",
            assumed_by=iam.ServicePrincipal("bedrock-agentcore.amazonaws.com"),
            description="Used by Bedrock AgentCore to process RFP files",
        )

        self.agent_exec_role.add_to_policy(
            iam.PolicyStatement(
                actions=["logs:DescribeLogGroups"],
                resources=[f"arn:aws:logs:{Stack.of(scope).region}:{Stack.of(scope).account}:log-group:*"],
            )
        )

        self.agent_exec_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "logs:DescribeLogStreams",
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents"
                ],
                resources=[
                    f"arn:aws:logs:{Stack.of(scope).region}:{Stack.of(scope).account}:log-group:/aws/bedrock-agentcore/runtimes/*",
                    f"arn:aws:logs:{Stack.of(scope).region}:{Stack.of(scope).account}:log-group:/aws/bedrock-agentcore/runtimes/*:log-stream:*"
                ],
            )
        )

        self.agent_exec_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "bedrock-agentcore:GetWorkloadAccessToken",
                    "bedrock-agentcore:GetWorkloadAccessTokenForJWT",
                    "bedrock-agentcore:GetWorkloadAccessTokenForUserId"
                ],
                resources=[
                    f"arn:aws:bedrock-agentcore:{Stack.of(scope).region}:{Stack.of(scope).account}:workload-identity-directory/default",
                    f"arn:aws:bedrock-agentcore:{Stack.of(scope).region}:{Stack.of(scope).account}:workload-identity-directory/default/workload-identity/*",
                ],
            )
        )

        self.agent_exec_role.add_to_policy(
            iam.PolicyStatement(
                actions=["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
                resources=[
                    f"arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
                    f"arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0",
                    f"arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-20250514-v1:0",
                    f"arn:aws:bedrock:*:{Stack.of(scope).account}:inference-profile/*"
                ],
            )
        )

        self.agent_exec_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "bedrock:Retrieve",
                    "bedrock:RetrieveAndGenerate",
                ],
                resources=[
                    f"arn:aws:bedrock:{Stack.of(scope).region}:{Stack.of(scope).account}:knowledge-base/{faq_knowledge_base_id}",
                    f"arn:aws:bedrock:{Stack.of(scope).region}:{Stack.of(scope).account}:knowledge-base/{docs_knowledge_base_id}",
                ],
            )
        )

        self.runtime = agentcore.Runtime(self, "RFPAgentRuntime",
            runtime_name="RFP_Answering_Agent",
            agent_runtime_artifact=self.agent_runtime_artifact,
            execution_role=self.agent_exec_role,
            environment_variables={
                "LOG_LEVEL": "INFO",
                "FAQ_KNOWLEDGE_BASE": faq_knowledge_base_id,
                "SUPPORTING_DOC_KNOWLEDGE_BASE": docs_knowledge_base_id,
                "JOB_TABLE_NAME": jobs_table.table_name,
                "AWS_REGION": region,
                "MAX_PARALLELISM": "5",
            }
        )

        self.artifact.repository.grant_pull(self.runtime)

        NagSuppressions.add_resource_suppressions(
            construct=self.agent_exec_role,
            suppressions=[
                NagPackSuppression(
                    id="AwsSolutions-IAM5",
                    reason="AgentCore Runtime requires wildcard permissions for CloudWatch Logs to function properly",
                    applies_to=[
                        "Resource::arn:<AWS::Partition>:logs:<AWS::Region>:<AWS::AccountId>:log-group:*",
                        "Resource::arn:<AWS::Partition>:logs:<AWS::Region>:<AWS::AccountId>:log-group:/aws/bedrock-agentcore/runtimes/*:log-stream:*",
                        "Resource::arn:<AWS::Partition>:logs:<AWS::Region>:<AWS::AccountId>:log-group:/aws/bedrock-agentcore/runtimes/*",
                        "Resource::arn:<AWS::Partition>:logs:<AWS::Region>:<AWS::AccountId>:log-group:/aws/bedrock-agentcore/runtimes/*:log-stream:*",
                        "Resource::arn:aws:logs:<AWS::Region>:<AWS::AccountId>:log-group:*",
                        "Resource::arn:aws:logs:<AWS::Region>:<AWS::AccountId>:log-group:/aws/bedrock-agentcore/runtimes/*:log-stream:*",
                        "Resource::arn:aws:logs:<AWS::Region>:<AWS::AccountId>:log-group:/aws/bedrock-agentcore/runtimes/*",
                        "Resource::arn:aws:logs:<AWS::Region>:<AWS::AccountId>:log-group:/aws/bedrock-agentcore/runtimes/*:log-stream:*"
                    ],
                ),
                NagPackSuppression(
                    id="AwsSolutions-IAM5",
                    reason="Bedrock cross-region model access requires wildcard permissions for inference profiles and foundation models",
                    applies_to=[
                        "Resource::arn:aws:bedrock:*:<AWS::AccountId>:inference-profile/*",
                        "Resource::arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
                        "Resource::arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0",
                        "Resource::arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-20250514-v1:0",

                        "Resource::arn:aws:bedrock:::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
                        "Resource::arn:aws:bedrock:::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0",
                        "Resource::arn:aws:bedrock:::foundation-model/anthropic.claude-sonnet-4-20250514-v1:0",
                    ],
                ),
                NagPackSuppression(
                    id="AwsSolutions-IAM5",
                    reason="AgentCore Runtime requires wildcard permissions for workload identity management",
                    applies_to=[
                        "Resource::arn:<AWS::Partition>:bedrock-agentcore:<AWS::Region>:<AWS::AccountId>:workload-identity-directory/default/workload-identity/*",
                        "Resource::arn:aws:bedrock-agentcore:<AWS::Region>:<AWS::AccountId>:workload-identity-directory/default/workload-identity/*",
                    ],
                ),
                NagPackSuppression(
                    id="AwsSolutions-IAM5",
                    reason="S3 bucket permissions require wildcards for object-level access",
                    applies_to=[
                        "Resource::<InferenceBucket95585283.Arn>/*",
                        "Action::s3:GetBucket*",
                        "Action::s3:GetObject*",
                        "Action::s3:List*",
                        "Action::s3:Abort*",
                        "Action::s3:DeleteObject*",
                    ],
                ),
                NagPackSuppression(
                    id="AwsSolutions-IAM5",
                    reason="DynamoDB index access requires wildcard permissions for table indexes",
                    applies_to=[
                        "Resource::<JobsTable1970BC16.Arn>/index/*",
                    ],
                ),
                NagPackSuppression(
                    id="AwsSolutions-IAM5",
                    reason="AgentCore needs star permissions to access ECR repository images",
                    applies_to=[
                        "Resource::*",
                    ],
                ),
                
            ],
            apply_to_children=True,
        )
