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

from datetime import datetime, UTC
from uuid import uuid4

from model.job import Job

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_job(s3_path: str) -> Job:
    """
    Creates processing job for an RFP file.
    
    :param s3_path: The RFP file URI on Amazon S3
    :type s3_path: str
    """
    now = datetime.now(UTC).isoformat()
    job = Job(
        job_id=str(uuid4()),
        status='RUNNING',
        input_s3_uri=s3_path,
        output_s3_uri=None,
        created_at=now,
        updated_at=now
    )
    logger.info(f'Starting job {job.job_id}')
    return job