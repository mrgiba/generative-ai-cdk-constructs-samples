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

from pydantic import BaseModel, Field

class ModelsConfig(BaseModel):
    reader: str = Field(
        "",
        description="Model ID for the model that will be used to read the RFP file"
    )

    answers: str = Field(
        "",
        description="Model ID for the model that will be used to generate the answers"
    )

    context: str = Field(
        "",
        description="Model ID for the model that will be used to retrieve and evaluate context"
    )

class KnowledgeBaseConfig(BaseModel):
    id: str = Field(
        description="The Knowledge Base ID (can be retrieved from the Ingestion Stack outputs)"
    )

    description: str = Field(
        description="A natural language description of the contents of this Knowledge Base. Will be used by the context agent to determine where to search."
    )

    results: int = Field(
        5,
        description="The max number of results to be retrieved from the context search."
    )

    limit_date_lookback: str = Field(
        "5 years",
        description="Time period restriction for searching for results in natural language. Will be used in the retrieve tool filters."
    )

class AgentConfig(BaseModel):
    version: str = Field(
        description="Config version"
    )

    name: str = Field(
        description="Config name"
    )

    language: str = Field(
        "English",
        description="The language the agent will answer the questions in."
    )

    models: ModelsConfig = Field(
        description="Granular configuration of which model will be used for agent tasks."
    )

    knowledge_bases: list[KnowledgeBaseConfig] = Field(
        description="Granular configuration of all knowledge bases that will be used for context retrieval."
    )

    

