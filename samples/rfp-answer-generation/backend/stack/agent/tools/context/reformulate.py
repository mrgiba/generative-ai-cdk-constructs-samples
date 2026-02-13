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

from strands import Agent, ToolContext, tool

AWS_REGION = os.environ.get("AWS_REGION")

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format=f'%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stdout,
)

logger = logging.getLogger(__name__)

PROMPT = """
Analyze the question below and decompose it into focused sub-questions that can be used for knowledge base retrieval. Each sub-question should target a specific aspect or component that might be found in different document chunks.

**Question**: {question}

Guidelines:
- If the question is already focused on a single concept, return it unchanged
- Break down complex questions into distinct, searchable components
- Ensure each sub-question can stand alone for retrieval purposes
- Preserve the original intent and context

Return a list of the extracted subquestions.
"""

@tool(context=True)
def reformulate_question(tool_context: ToolContext, question: str) -> str:
    """
    Reformulates the original question, breaking it down into focused sub-questions to improve context retrieval.
    
    :param tool_context: Tool context.
    :type tool_context: ToolContext
    :param question: The question in plain text.
    :type question: str
    :return: The reformulated subquestions.
    :rtype: str
    """
    logger.info(f"Reformulating question: `{question}`")

    agent = Agent(
        messages=[],
        tools=[],
    )

    return agent(PROMPT.format(question=question))