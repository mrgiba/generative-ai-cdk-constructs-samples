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
import shutil

from aws_cdk import (
    aws_iam as iam,
    aws_lambda as lambda_,
    aws_bedrock as bedrock_cfn,
    CfnOutput,
    Duration,
    Stack,
)
from constructs import Construct
from cdk_nag import NagSuppressions, NagPackSuppression
from cdklabs.generative_ai_cdk_constructs import s3vectors

from .constants.prompts import SUPPORTING_DOCUMENT_PARSING_PROMPT
from .stack_constructs import (
    BucketConstruct,
    PythonFunctionConstruct,
    ServerAccessLogsBucketConstruct,
)

class IngestionStack(Stack):
    def __init__(
        self,
        scope: Construct,
        id: str,
        **kwargs,
    ):
        super().__init__(scope, id, **kwargs)

        # Create S3 Vector Buckets and Indexes for both FAQ and Supporting Docs
        self.faq_vector_bucket = s3vectors.VectorBucket(
            self, "FAQVectorBucket"
        )

        self.faq_vector_index = s3vectors.VectorIndex(
            self,
            "FAQVectorIndex",
            vector_bucket=self.faq_vector_bucket,
            dimension=1024,
            distance_metric=s3vectors.VectorIndexDistanceMetric.COSINE,
            data_type=s3vectors.VectorIndexDataType.FLOAT_32,
            non_filterable_metadata_keys=[
                "AMAZON_BEDROCK_METADATA",
                "AMAZON_BEDROCK_TEXT",
                "x-amz-bedrock-kb-data-source-id",
                "x-amz-bedrock-kb-source-file-modality",
                "question",
                "answer",
            ]
            # merchant and lastModified are filterable by default (not in non_filterable list)
        )

        self.doc_vector_bucket = s3vectors.VectorBucket(
            self, "DocVectorBucket"
        )

        self.doc_vector_index = s3vectors.VectorIndex(
            self,
            "DocVectorIndex",
            vector_bucket=self.doc_vector_bucket,
            dimension=1024,
            distance_metric=s3vectors.VectorIndexDistanceMetric.COSINE,
            data_type=s3vectors.VectorIndexDataType.FLOAT_32,
            non_filterable_metadata_keys=[
                "AMAZON_BEDROCK_METADATA",
                "AMAZON_BEDROCK_TEXT",
                "x-amz-bedrock-kb-data-source-id",
                "x-amz-bedrock-kb-source-file-modality",
            ]
            # merchant and lastModified are filterable by default (not in non_filterable list)
        )

        self.logging_bucket = ServerAccessLogsBucketConstruct(
            self,
            "LoggingBucket",
        )

        self.supporting_doc_bucket = BucketConstruct(
            self,
            "SupportingDocumentsBucket",
            server_access_logs_bucket=self.logging_bucket,
        )

        self.faq_custom_transformation_bucket = BucketConstruct(
            self,
            "FAQCustomTransformationBucket",
            server_access_logs_bucket=self.logging_bucket,
        )

        self.faq_bucket = BucketConstruct(
            self,
            "FAQBucket",
            server_access_logs_bucket=self.logging_bucket,
        )

        CfnOutput(
            self,
            "IngestionBucketFAQ",
            value=self.faq_bucket.bucket_name,
        )

        CfnOutput(
            self,
            "IngestionBucketSupportingDocs",
            value=self.supporting_doc_bucket.bucket_name,
        )

        ##############################################
        # FAQs
        ##############################################

        # Create Knowledge Base role with S3 Vectors permissions
        self.faq_kb_role = iam.Role(
            self,
            "FAQKnowledgeBaseRole",
            assumed_by=iam.ServicePrincipal("bedrock.amazonaws.com"),
        )

        self.faq_kb_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "s3vectors:PutVectors",
                    "s3vectors:GetVectors",
                    "s3vectors:DeleteVectors",
                    "s3vectors:QueryVectors",
                    "s3vectors:GetIndex",
                ],
                resources=[self.faq_vector_index.vector_index_arn],
            )
        )

        self.faq_kb_role.add_to_policy(
            iam.PolicyStatement(
                actions=["bedrock:InvokeModel"],
                resources=[
                    f"arn:aws:bedrock:{Stack.of(self).region}::foundation-model/amazon.titan-embed-text-v2:0"
                ],
            )
        )

        self.faq_bucket.grant_read(self.faq_kb_role)

        # Create Knowledge Base using CfnKnowledgeBase for S3 Vectors support
        self.faq_knowledge_base_cfn = bedrock_cfn.CfnKnowledgeBase(
            self,
            "FAQKnowledgeBase",
            name=f"{Stack.of(self).stack_name}-faq-kb",
            role_arn=self.faq_kb_role.role_arn,
            knowledge_base_configuration=bedrock_cfn.CfnKnowledgeBase.KnowledgeBaseConfigurationProperty(
                type="VECTOR",
                vector_knowledge_base_configuration=bedrock_cfn.CfnKnowledgeBase.VectorKnowledgeBaseConfigurationProperty(
                    embedding_model_arn=f"arn:aws:bedrock:{Stack.of(self).region}::foundation-model/amazon.titan-embed-text-v2:0"
                ),
            ),
            storage_configuration=bedrock_cfn.CfnKnowledgeBase.StorageConfigurationProperty(
                type="S3_VECTORS",
                s3_vectors_configuration=bedrock_cfn.CfnKnowledgeBase.S3VectorsConfigurationProperty(
                    vector_bucket_arn=self.faq_vector_bucket.vector_bucket_arn,
                    index_arn=self.faq_vector_index.vector_index_arn,
                ),
            ),
        )
        self.faq_knowledge_base_cfn.node.add_dependency(self.faq_kb_role)

        self.faq_custom_transformation_function = PythonFunctionConstruct(
            self,
            "FAQCustomTransformationFn",
            entry=os.path.join(
                os.path.dirname(__file__), "lambdas", "custom_chunking_handler_fn"
            ),
            index="app/handler.py",
            handler="handler",
            runtime=lambda_.Runtime.PYTHON_3_14,
            memory_size=1024,
            architecture=lambda_.Architecture.X86_64,
            timeout=Duration.minutes(15),
            environment={
                "LOG_LEVEL": "INFO",
            },
        )

        self.faq_custom_transformation_function.add_to_role_policy(
            iam.PolicyStatement(
                actions=[
                    "bedrock:InvokeModel",
                ],
                resources=[
                    f"arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
                    f"arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0",
                    f"arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-20250514-v1:0",
                    f"arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v2:0",
                    f"arn:aws:bedrock:{Stack.of(self).region}:{Stack.of(self).account}:inference-profile/*"
                ],
            )
        )

        self.faq_bucket.grant_read_write(self.faq_custom_transformation_function.role)

        self.faq_custom_transformation_bucket.grant_read_write(
            self.faq_custom_transformation_function.role
        )

        self.faq_custom_transformation_bucket.grant_read_write(self.faq_kb_role)
        self.faq_custom_transformation_function.grant_invoke(self.faq_kb_role)

        self.faq_data_source = bedrock_cfn.CfnDataSource(
            self,
            "FAQDataSource",
            name="faq_data_source",
            knowledge_base_id=self.faq_knowledge_base_cfn.attr_knowledge_base_id,
            data_source_configuration=bedrock_cfn.CfnDataSource.DataSourceConfigurationProperty(
                type="S3",
                s3_configuration=bedrock_cfn.CfnDataSource.S3DataSourceConfigurationProperty(
                    bucket_arn=self.faq_bucket.bucket_arn
                ),
            ),
            vector_ingestion_configuration=bedrock_cfn.CfnDataSource.VectorIngestionConfigurationProperty(
                chunking_configuration=bedrock_cfn.CfnDataSource.ChunkingConfigurationProperty(
                    chunking_strategy="NONE"
                ),
                custom_transformation_configuration=bedrock_cfn.CfnDataSource.CustomTransformationConfigurationProperty(
                    intermediate_storage=bedrock_cfn.CfnDataSource.IntermediateStorageProperty(
                        s3_location=bedrock_cfn.CfnDataSource.S3LocationProperty(
                            uri=f"s3://{self.faq_custom_transformation_bucket.bucket_name}/"
                        )
                    ),
                    transformations=[
                        bedrock_cfn.CfnDataSource.TransformationProperty(
                            step_to_apply="POST_CHUNKING",
                            transformation_function=bedrock_cfn.CfnDataSource.TransformationFunctionProperty(
                                transformation_lambda_configuration=bedrock_cfn.CfnDataSource.TransformationLambdaConfigurationProperty(
                                    lambda_arn=self.faq_custom_transformation_function.function_arn
                                )
                            ),
                        )
                    ],
                ),
            ),
        )

        ##############################################
        # Supporting Documents
        ##############################################

        # Create Knowledge Base role with S3 Vectors permissions
        self.doc_kb_role = iam.Role(
            self,
            "DocKnowledgeBaseRole",
            assumed_by=iam.ServicePrincipal("bedrock.amazonaws.com"),
        )

        self.doc_kb_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "s3vectors:PutVectors",
                    "s3vectors:GetVectors",
                    "s3vectors:DeleteVectors",
                    "s3vectors:QueryVectors",
                    "s3vectors:GetIndex",
                ],
                resources=[self.doc_vector_index.vector_index_arn],
            )
        )

        self.doc_kb_role.add_to_policy(
            iam.PolicyStatement(
                actions=["bedrock:InvokeModel", "bedrock:GetInferenceProfile"],
                resources=[
                    f"arn:aws:bedrock:{Stack.of(self).region}:{Stack.of(self).account}:inference-profile/*",
                    f"arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v2:0",
                    f"arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-20250514-v1:0",
                ],
            )
        )

        self.supporting_doc_bucket.grant_read(self.doc_kb_role)

        # Create Knowledge Base using CfnKnowledgeBase for S3 Vectors support
        self.supporting_doc_knowledge_base_cfn = bedrock_cfn.CfnKnowledgeBase(
            self,
            "SupportingDocumentsKnowledgeBase",
            name=f"{Stack.of(self).stack_name}-doc-kb",
            role_arn=self.doc_kb_role.role_arn,
            knowledge_base_configuration=bedrock_cfn.CfnKnowledgeBase.KnowledgeBaseConfigurationProperty(
                type="VECTOR",
                vector_knowledge_base_configuration=bedrock_cfn.CfnKnowledgeBase.VectorKnowledgeBaseConfigurationProperty(
                    embedding_model_arn=f"arn:aws:bedrock:{Stack.of(self).region}::foundation-model/amazon.titan-embed-text-v2:0"
                ),
            ),
            storage_configuration=bedrock_cfn.CfnKnowledgeBase.StorageConfigurationProperty(
                type="S3_VECTORS",
                s3_vectors_configuration=bedrock_cfn.CfnKnowledgeBase.S3VectorsConfigurationProperty(
                    vector_bucket_arn=self.doc_vector_bucket.vector_bucket_arn,
                    index_arn=self.doc_vector_index.vector_index_arn,
                ),
            ),
        )
        self.supporting_doc_knowledge_base_cfn.node.add_dependency(self.doc_kb_role)

        self.supporting_doc_data_source = bedrock_cfn.CfnDataSource(
            self,
            "SupportingDocumentsDataSource",
            name="supporting_docs_data_source",
            knowledge_base_id=self.supporting_doc_knowledge_base_cfn.attr_knowledge_base_id,
            data_source_configuration=bedrock_cfn.CfnDataSource.DataSourceConfigurationProperty(
                type="S3",
                s3_configuration=bedrock_cfn.CfnDataSource.S3DataSourceConfigurationProperty(
                    bucket_arn=self.supporting_doc_bucket.bucket_arn
                ),
            ),
            vector_ingestion_configuration=bedrock_cfn.CfnDataSource.VectorIngestionConfigurationProperty(
                chunking_configuration=bedrock_cfn.CfnDataSource.ChunkingConfigurationProperty(
                    chunking_strategy="FIXED_SIZE",
                    fixed_size_chunking_configuration=bedrock_cfn.CfnDataSource.FixedSizeChunkingConfigurationProperty(
                        max_tokens=300,
                        overlap_percentage=20,
                    ),
                ),
                parsing_configuration=bedrock_cfn.CfnDataSource.ParsingConfigurationProperty(
                    parsing_strategy="BEDROCK_FOUNDATION_MODEL",
                    bedrock_foundation_model_configuration=bedrock_cfn.CfnDataSource.BedrockFoundationModelConfigurationProperty(
                        model_arn=f"arn:aws:bedrock:{Stack.of(self).region}:{Stack.of(self).account}:inference-profile/us.anthropic.claude-sonnet-4-20250514-v1:0",
                        parsing_prompt=bedrock_cfn.CfnDataSource.ParsingPromptProperty(
                            parsing_prompt_text=SUPPORTING_DOCUMENT_PARSING_PROMPT
                        ),
                    ),
                ),
            ),
        )

        self.template_options.description='Description: (uksb-1tupboc43) (tag:rfp-answer-generation)'

        NagSuppressions.add_resource_suppressions(
            construct=self.faq_custom_transformation_function.role,
            suppressions=[
                NagPackSuppression(
                    id="AwsSolutions-IAM5",
                    reason="Custom transformation needs to support non-standardized object naming.",
                    applies_to=[
                        "Resource::<FAQBucketBF1EE662.Arn>/*",
                        "Resource::<FAQCustomTransformationBucket3331BD34.Arn>/*",
                        "Action::s3:GetBucket*",
                        "Action::s3:GetObject*",
                        "Action::s3:List*",
                        "Action::s3:Abort*",
                        "Action::s3:DeleteObject*",
                    ]
                ),
                NagPackSuppression(
                    id="AwsSolutions-IAM5",
                    reason="Star permissions required for Cross-Region Inference.",
                    applies_to=[
                        "Resource::arn:aws:bedrock:<AWS::Region>:<AWS::AccountId>:inference-profile/*",
                        "Resource::arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0",
                        "Resource::arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0",
                        "Resource::arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-20250514-v1:0",
                        "Resource::arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v2:0",
                    ]
                ),
            ],
            apply_to_children=True,
        )

        NagSuppressions.add_resource_suppressions(
            construct=self.faq_kb_role,
            suppressions=[
                NagPackSuppression(
                    id="AwsSolutions-IAM5",
                    reason="Knowledge Base requires wildcard permissions to read S3 objects with dynamic names.",
                    applies_to=[
                        "Resource::<FAQBucketBF1EE662.Arn>/*",
                        "Resource::<FAQCustomTransformationBucket3331BD34.Arn>/*",
                        "Resource::<FAQCustomTransformationFnE1201716.Arn>:*",
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

        NagSuppressions.add_resource_suppressions(
            construct=self.doc_kb_role,
            suppressions=[
                NagPackSuppression(
                    id="AwsSolutions-IAM5",
                    reason="Knowledge Base requires wildcard permissions to read S3 objects with dynamic names.",
                    applies_to=[
                        "Resource::<SupportingDocumentsBucketB0C65E11.Arn>/*",
                        "Action::s3:GetBucket*",
                        "Action::s3:GetObject*",
                        "Action::s3:List*",
                    ]
                ),
                NagPackSuppression(
                    id="AwsSolutions-IAM5",
                    reason="Star permissions required for Cross-Region Inference.",
                    applies_to=[
                        "Resource::arn:aws:bedrock:<AWS::Region>:<AWS::AccountId>:inference-profile/*",
                        "Resource::arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v2:0",
                        "Resource::arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-20250514-v1:0",
                    ]
                ),
            ],
            apply_to_children=True,
        )
