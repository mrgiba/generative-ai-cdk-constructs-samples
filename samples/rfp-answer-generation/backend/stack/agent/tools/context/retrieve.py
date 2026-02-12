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
import logging
import sys

from strands import ToolContext, tool

from timelength import TimeLength
from datetime import datetime

from tools.aws.clients import get_bedrock_kb_client
from model.config import KnowledgeBaseConfig

AWS_REGION = os.environ.get("AWS_REGION")

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stdout,
)

logger = logging.getLogger(__name__)

def configure_filter_date_filter(cutoff_date: str):
    tl = TimeLength(cutoff_date)
    cutoff = int(tl.ago(datetime.now()).timestamp())
    return { "greaterThanOrEquals": { "key": "timestamp", "value": cutoff} }

@tool(context=True)
def retrieve_context(tool_context: ToolContext, question: str, knowledge_base_id: str) -> str:
    """
    Retrieves content related to a question from a knowledge base.
    
    :param tool_context: Tool context.
    :type tool_context: ToolContext
    :param question: The question in plain text.
    :type question: str
    :param knowledge_base_id: The Knowledge Base ID.
    :type knowledge_base_id: str
    :return: The Markdown-formatted context retrieved from the Knowledge Base.
    :rtype: str
    """
    logger.info(f"Retrieving context from KB {knowledge_base_id} for question: `{question}`")

    kb_config: KnowledgeBaseConfig = [kb_config for kb_config in tool_context.agent.config.knowledge_bases if kb_config.id == knowledge_base_id][0]
    client = get_bedrock_kb_client(AWS_REGION)
    
    date_filter = configure_filter_date_filter(kb_config.limit_date_lookback)

    try:
        # Perform retrieval
        response = client.retrieve(
            retrievalQuery={"text": question}, 
            knowledgeBaseId=knowledge_base_id, 
            retrievalConfiguration={
                'vectorSearchConfiguration': {
                    'numberOfResults': kb_config.results,
                    'filter': date_filter
                }
            }
        )

        results = response.get("retrievalResults", [])
        logger.info(f"Retrieved {len(results)} results")

        formatted = []
        for result in results:
            content = result.get('content', {}).get('text', '')
            score = result.get("score", 0.0)
            metadata = result.get("metadata", {})

            txt = f"### Text\n\n{content}\n\n"
            txt += f"### Score\n\n{score}\n\n"
            txt += f"### Metadata\n\n#### Date Modified\n\n{metadata.get('lastModified')}\n\n"

            formatted.append(txt)

        return "".join(formatted)


    except Exception as e:
        logger.error(f"Could not retrieve results for question: `{question}`. Error: {e}", exc_info=True)

    return results



