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

from concurrent.futures import ThreadPoolExecutor
from logging import Logger
from typing import Any

import openpyxl
from botocore.config import Config
from strands import Agent
from strands.models import BedrockModel

from model.question import Question, Questions

from utils.config import load_config

BOTO_CLIENT_CONFIG = Config(retries={'max_attempts': 20, 'mode': 'adaptive'})
MODEL_TEMPERATURE = 0
SYSTEM_PROMPT = (
    'Extract all questions and information requests from the provided RFP Excel sheet. '
    'This includes direct questions, fields requesting information, and any prompts that need to be filled in. '
    'Return the question/request text and their answer cell locations using full Excel references (SheetName!CellAddress). '
    'Ignore sheets with only instructions, notes, or other non-question content. '
    'Return an empty list if the sheet contains no questions or information requests.'
)
MAX_WORKERS = 5

class QuestionsAgent(Agent):
    """
    Agent focused on extracting questions from RFP Excel files using LLMs.
    """
    def __init__(self, tools: list[str | dict[str, str] | Any] | None = None):
        self.config = load_config()

        bedrock_model = BedrockModel(
            boto_client_config=BOTO_CLIENT_CONFIG,
            model_id=self.config.models.reader,
            temperature=MODEL_TEMPERATURE
        )

        super().__init__(
            model=bedrock_model,
            system_prompt=SYSTEM_PROMPT,
            tools=tools,
            callback_handler=None
        )

    def get_questions(self, excel_filepath: str, sheet: str) -> list[Question]:
        """
        Extracts all question from a sheet.
        
        :param excel_filepath: The local file path for the RFP excel file.
        :type excel_filepath: str
        :param sheet: The name of the sheet.
        :return: A list of questions (defined by: the question in plain text and the identifier of the cell where the answer is expected)
        :rtype: list[Question]
        """
        self(f'Excel file: {excel_filepath}\nSheet: {sheet}')
        return self.structured_output(Questions).questions #.model_dump()['questions']


class ExcelReader:
    """
    Reads RFP Excel files and extracts questions from visible sheets.
    """
    def __init__(self, logger: Logger, tools: list[str | dict[str, str] | Any] | None = None):
        self.logger = logger
        self.tools = tools

    def get_questions(self, excel_filepath: str) -> list[Question]:
        """
        Uses the Questions Agent to analyze each visible sheet in the RFP file and extract all questions to be answered.
        
        :param excel_filepath: The local file path for the RFP excel file.
        :type excel_filepath: str
        :return:  A list of questions (defined by: the question in plain text and the identifier of the cell where the answer is expected).
        :rtype: list[str]
        """
        self.logger.info(f'Reading Excel file: {excel_filepath}')
        sheets = self.get_visible_sheets(excel_filepath)

        def process_sheet(sheet: str) -> list[Question]:
            self.logger.info(f'Getting questions from sheet: {sheet}')
            agent = QuestionsAgent(self.tools)
            return agent.get_questions(excel_filepath, sheet)

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            results = executor.map(process_sheet, sheets)

        return [q for questions in results for q in questions]

    def get_visible_sheets(self, excel_filepath: str) -> list[str]:
        """
        Loads the Excel RFP file and retrieves the names for all visible excel sheets.
        
        :param excel_filepath: Description
        :type excel_filepath: str
        :return: The list of visible sheet names.
        :rtype: list[str]
        """
        self.logger.info('Getting visible sheets')
        workbook = openpyxl.load_workbook(excel_filepath, read_only=True)
        return [sheet.title for sheet in workbook.worksheets if sheet.sheet_state == 'visible']
