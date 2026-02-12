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
import os

from datetime import datetime, UTC

from model.job import Job
from tools.aws.clients import get_session

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

AWS_REGION = os.environ.get("AWS_REGION")

dynamodb = get_session().resource('dynamodb')
dynamodb_table = dynamodb.Table(os.getenv('JOB_TABLE_NAME'))

def save_job(job: Job):
    """
    Saves job information to the jobs DynamoDB table.
    
    :param job: The Job to save.
    :type job: Job
    """
    job.updated_at = datetime.now(UTC).isoformat()
    logger.info(f'Updating job {job.job_id} ({job.status})')
    dynamodb_table.put_item(Item=job.model_dump())