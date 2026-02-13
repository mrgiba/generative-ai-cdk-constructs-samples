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
Evaluate if the retrieved context can adequately answer the target question.

**Question:** {question}
**Context:** {context}

**Task:** 
Determine if the context is:
- SUFFICIENT: Contains all info needed for complete answer
- PARTIAL: Contains some relevant info but missing key details  
- INSUFFICIENT: Lacks necessary information

**Response Format:**
Status: [SUFFICIENT | PARTIAL | INSUFFICIENT]
Explanation: [Brief reasoning]
Missing: [What's lacking, if applicable]
"""

@tool(context=True)
def evaluate_context(tool_context: ToolContext, question: str, context: str) -> str:
    """
    Evaluates the context retrieved for a question, determining whether the information retrieved is sufficient, partially sufficient or insufficient to accurately answer the question.
    
    :param tool_context: Tool context.
    :type tool_context: ToolContext
    :param question: The question in plain text.
    :type question: str
    :param context: The context extracted from the Knowledge Base.
    :type context: str
    :return: A concise evaluation for the information presented.
    :rtype: str
    """
    logger.info(f"Evaluating context retrieved for question: `{question}`")

    agent = Agent(
        messages=[],
        tools=[],
    )

    return agent(PROMPT.format(question=question, context=context))

