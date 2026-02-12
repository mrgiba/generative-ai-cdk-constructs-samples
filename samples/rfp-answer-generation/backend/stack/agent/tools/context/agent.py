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

from typing import Any
from pydantic import BaseModel
from strands import Agent
from strands.agent import AgentResult
from strands.models import BedrockModel
from botocore.config import Config

from tools.context.retrieve import retrieve_context
from tools.context.evaluate import evaluate_context
from tools.context.reformulate import reformulate_question

from model.answer import Answer
from utils.config import load_config

SYSTEM_PROMPT = """
# Context
You are a skilled assistant, expert in reading, comprehension, and factual analysis of text.

# Task
You are helping answer a Request for Proposal (RFP) document, one question at a time.
Your task has two phases:
1. Systematically search the company's Knowledge Bases to find relevant content
2. Provide a factual, grounded answer based solely on the retrieved content

# Information
You have access to the following Knowledge Bases:
{knowledge_bases}

Available tools:
- Context retrieval tool: retrieves context
- Content evaluation tool: assesses relevance and sufficiency of retrieved content
- Question reformulation tool: generates alternative phrasings for better search results

# Phase 1: Content Retrieval

Follow this systematic approach:

## Step 1: Question Analysis
- Carefully analyze the question to identify all components
- If the question contains multiple subquestions or requests, identify and classify each component separately
- Note key terms and concepts that should guide your search

## Step 2: Initial Search
- Start with the first Knowledge Base (KB) in your list
- Use the original question to retrieve context
- Use the evaluation tool to determine if the content retrieved is sufficient for answering the question:
  * **Sufficient**: Content fully addresses all aspects of the question
  * **Partially sufficient**: Content addresses some aspects but lacks completeness
  * **Insufficient**: Content is irrelevant or doesn't address the question

## Step 3: [Optional] Iterative Improvement (if needed)
If content is "partially sufficient" or "insufficient":
- Use the question reformulation tool to generate alternative search queries. Do not rephrase on your own.
- Search the same KB again with each reformulated query
- Evaluate all newly retrieved content
- Repeat this step up to [X] times per KB if results continue to improve

## Step 4: [Optional] Next Knowledge Base (if needed)
If content remains "partially sufficient" or "insufficient" after Step 3:
- Move to the next KB in your list
- Repeat Steps 2-3 for this new KB
- Continue until you've exhausted all available KBs

# Phase 2: Answer Generation

Once you have completed the retrieval phase, follow these rules to generate your answer:

## Answer Requirements
- **If NO relevant context was found**: Respond with exactly "I don't know" and nothing else
- **If PARTIAL context was found**: Answer only what can be directly supported by the retrieved content. For aspects without supporting information, clearly state "I don't know" for those specific parts
- **If SUFFICIENT context was found**: Provide a complete, detailed answer based solely on the retrieved content

## Strict Constraints
- Base your answer ONLY on information explicitly stated in the retrieved content
- Making assumptions is **forbidden**
- Making deductions is **forbidden**
- Making inferences about likely statements is **forbidden**
- Mentioning the knowledge base in your response is **forbidden**
- Mentioning any tag names or metadata in your response is **forbidden**
- Using Markdown to structure your response is **forbidden**

## Answer Generation Process
1. Thoroughly read each piece of retrieved content
2. For each component of the question identified in Step 1, determine what information from the retrieved content directly addresses it
3. Think step-by-step about how to structure an objective, detailed, and factual answer
4. Write your answer in {language}, ensuring every statement can be traced back to the retrieved content
5. If addressing multiple subquestions, answer each one separately and clearly
6. Provide your answer in plain text. Do not use Markdown, as the answer will be pasted into an Excel cell.

## Quality Standards
- Prioritize accuracy over completeness
- Use specific details and facts from the retrieved content
- Maintain an objective, professional tone
- Organize information logically and clearly
- If the retrieved content contains conflicting information, present both perspectives as they appear in the source material

# Success Criteria
- Thoroughness in search process (Phase 1)
- Complete factual grounding in retrieved content (Phase 2)
- Clear acknowledgment of knowledge gaps when they exist
- Professional, well-structured responses
- Plain text answers without any sort of preamble.
"""

class AnsweringAgent(Agent):
    """
    Answers an RFP question fetching contextual information from previously answered RFPs and supporting documentation as needed.

    Comes preloded with 3 tools:
    - retrieve_context: retrieves context for answering question from the Knowledge Bases configured in `config.yaml`.
    - evaluate_context: evaluates context retrieved from a Knowledge Base as sufficient, partially sufficient or insufficient.
    - reformulate_question: reformulates question to improve context searches.
    """
    def __init__(self, tools: list[str | dict[str, str] | Any] = [], structured_output_model: BaseModel = Answer):
        self.config = load_config()

        bedrock_model = BedrockModel(
            model_id=self.config.models.answers,
            temperature=0.0,
            max_tokens=8000,
            boto_client_config=Config(
                connect_timeout=300,
                read_timeout=600,
                retries={
                    "max_attempts": 50,
                    "mode": "adaptive",
                },
            )
        )

        kbs_description = "\n".join([ f"- {kb.id}: {kb.description}" for kb in self.config.knowledge_bases])

        super().__init__(
            model=bedrock_model,
            system_prompt=SYSTEM_PROMPT.format(knowledge_bases=kbs_description, language=self.config.language),
            tools=[
                retrieve_context,
                evaluate_context,
                reformulate_question,
                *tools,
            ],
            structured_output_model=structured_output_model
        )

    # def answer_question(self, question: str) -> AgentResult:
    #     """
    #     Answers an RFP question fetching contextual information from previously answered RFPs and supporting documentation as needed.
        
    #     :param question: The question in plain text
    #     :type question: str
    #     :return: The answer (a pair of the plain text answer and any potential improvement comments to be added to the answer cell)
    #     :rtype: Answer
    #     """

    #     return self(question)