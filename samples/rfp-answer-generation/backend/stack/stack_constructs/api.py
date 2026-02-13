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
    aws_iam as iam,
    aws_lambda as lambda_,
    aws_s3 as s3,
    Duration,
)
from constructs import Construct
from cdk_nag import NagSuppressions, NagPackSuppression

from .apigateway import ApiGatewayConstruct
from .aws_lambda import PythonFunctionConstruct
from .cognito import CognitoConstruct


class APIConstruct(Construct):
    def __init__(
        self,
        scope: Construct,
        id: str,
        region: str,
        inference_bucket: s3.Bucket,
        jobs_table: dynamodb.Table,
        **kwargs,
    ):
        super().__init__(scope, id, **kwargs)

        self.cognito = CognitoConstruct(
            self,
            "Cognito",
            region=region,
        )

        self.apigw = ApiGatewayConstruct(
            self,
            "ApiGateway",
            region=region,
            user_pool=self.cognito.user_pool,
        )

        self.get_jobs_fn = PythonFunctionConstruct(
            self,
            "GetJobsFunction",
            entry=os.path.join(
                os.path.dirname(__file__), "..", "lambdas", "get_jobs_fn"
            ),
            index="index.py",
            handler="handler",
            runtime=lambda_.Runtime.PYTHON_3_14,
            timeout=Duration.minutes(1),
            environment={
                "LOG_LEVEL": "INFO",
                "JOBS_TABLE": jobs_table.table_name,
            },
        )

        self.get_job_result_fn = PythonFunctionConstruct(
            self,
            "GetJobResultFunction",
            entry=os.path.join(
                os.path.dirname(__file__), "..", "lambdas", "get_job_result_fn"
            ),
            index="index.py",
            handler="handler",
            runtime=lambda_.Runtime.PYTHON_3_14,
            timeout=Duration.minutes(1),
            environment={
                "LOG_LEVEL": "INFO",
                "JOBS_TABLE": jobs_table.table_name,
            },
        )

        # API methods
        self.apigw.add_lambda_method(
            resource_path="/jobs",
            http_method="GET",
            lambda_function=self.get_jobs_fn,
            request_validator=self.apigw.request_body_params_validator,
        )

        self.apigw.add_lambda_method(
            resource_path="/job/{job_id}",
            http_method="GET",
            lambda_function=self.get_job_result_fn,
            request_validator=self.apigw.request_body_params_validator,
        )

        self.api_gw_exec_role = iam.Role(
            self,
            "APIGWExecutionRole",
            assumed_by=iam.ServicePrincipal("apigateway.amazonaws.com"),
            description="Used by API Gateway to execute S3 operations",
        )

        self.apigw.add_s3_method(
            resource_path="/inference/{key}",
            folder="inference",
            http_method="PUT",
            request_validator=self.apigw.request_body_validator,
            execution_role=self.api_gw_exec_role,
            bucket_name=inference_bucket.bucket_name,
        )

        jobs_table.grant_read_data(self.get_jobs_fn.role)
        jobs_table.grant_read_data(self.get_job_result_fn.role)

        inference_bucket.grant_read_write(self.api_gw_exec_role)
        inference_bucket.grant_read(self.get_job_result_fn.role)

        NagSuppressions.add_resource_suppressions(
            construct=self.get_jobs_fn.role,
            suppressions=[
                NagPackSuppression(
                    id="AwsSolutions-IAM5",
                    reason="DynamoDB index access requires wildcard permissions for table indexes.",
                    applies_to=[
                        "Resource::<JobsTable1970BC16.Arn>/index/*"
                    ],
                ),
            ],
            apply_to_children=True,
        )

        NagSuppressions.add_resource_suppressions(
            construct=self.get_job_result_fn.role,
            suppressions=[
                NagPackSuppression(
                    id="AwsSolutions-IAM5",
                    reason="Wildcard used to support multiple object folders and names.",
                    applies_to=[
                        "Resource::<JobsTable1970BC16.Arn>/index/*",
                        "Resource::<InferenceBucket95585283.Arn>/*",
                        "Action::s3:GetBucket*",
                        "Action::s3:GetObject*",
                        "Action::s3:List*",
                    ]
                ),
            ],
            apply_to_children=True,
        )

        NagSuppressions.add_resource_suppressions(
            construct=self.api_gw_exec_role,
            suppressions=[
                NagPackSuppression(
                    id="AwsSolutions-IAM5",
                    reason="API Gateway uses wildcard used because object naming is not standardized",
                    applies_to=[
                        "Resource::<InferenceBucket95585283.Arn>/*",
                        "Action::s3:GetBucket*",
                        "Action::s3:GetObject*",
                        "Action::s3:List*",
                        "Action::s3:Abort*",
                        "Action::s3:DeleteObject*",
                    ]
                ),
            ],
            apply_to_children=True,
        )
