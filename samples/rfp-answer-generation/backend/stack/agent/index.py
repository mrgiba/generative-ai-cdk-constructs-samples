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

import logging
import traceback
import threading

from bedrock_agentcore.runtime import BedrockAgentCoreApp

from model.question import Question
from model.answer import Answer
from tools.context.agent import AnsweringAgent
from tools.jobs.create import create_job
from tools.jobs.save import save_job

from tools.aws.s3 import download_file_from_s3, upload_file_to_s3
from tools.excel.mcp import excel_mcp_client
from tools.excel.reader import ExcelReader
from tools.excel.writer import ExcelWriter

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = BedrockAgentCoreApp()

def get_questions(filepath: str) -> list[Question]:
    logger.info('Getting questions')
    with excel_mcp_client:
        excel_reader = ExcelReader(logger, [excel_mcp_client.list_tools_sync()])
        return excel_reader.get_questions(filepath)


def answer_questions(questions: list[Question]) -> list[dict]:
    logger.info('Answering questions')

    answers = []
    for question in questions:
        answering_agent = AnsweringAgent()
        answer = answering_agent(question.question)
        answer_info: Answer = answer.structured_output
        answers.append({
            'answer': answer_info.answer,
            'comment': answer_info.comment,
            'cell': question.answer_cell
        })
    return answers


def write_answers(filepath: str, answers: list[Answer]):
    logger.info('Writing answers in Excel file')
    ExcelWriter(filepath).write_answers(answers)


def process_job_in_background(s3_path: str, task_id: str) -> str:
    job = None
    try:
        job = create_job(s3_path)
        save_job(job)

        filepath = download_file_from_s3(s3_path)
        questions = get_questions(filepath)
        answers = answer_questions(questions)

        write_answers(filepath, answers)

        job.output_s3_uri = upload_file_to_s3(s3_path, filepath)
        job.status = 'SUCCEEDED'
        save_job(job)

        app.complete_async_task(task_id)

        return job.model_dump()
    except Exception:
        if job:
            job.status = 'FAILED'
            save_job(job)

        traceback.print_exc()
        return 'error'

@app.entrypoint
def handler(payload):
    s3_path = payload.get('s3_path')
    logger.info(f'S3 path: {s3_path}')

    task_id = app.add_async_task(f"RFP_File_{s3_path}")
    threading.Thread(target=process_job_in_background, args=(s3_path, task_id), daemon=True).start()

    return f"Started processing file {s3_path} in background (Task ID: {task_id}). Agent status is now BUSY."


if __name__ == '__main__':
    app.run()
