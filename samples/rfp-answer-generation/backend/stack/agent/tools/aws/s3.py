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

from cloudpathlib import S3Path

from tools.aws.clients import get_s3_client, get_sts_client

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

AWS_REGION = os.environ.get("AWS_REGION")
client = get_s3_client(AWS_REGION)
sts_client = get_sts_client(AWS_REGION)
ACCOUNT_ID = sts_client.get_caller_identity()["Account"]

def download_file_from_s3(s3_path: str) -> str:
    """
    Downloads file from Amazon S3.
    
    :param s3_path: The S3 URI for the object on Amazon S3.
    :type s3_path: str
    :return: The local path for the downloaded file.
    :rtype: str
    """
    logger.info('Downloading file from S3')
    path = S3Path(s3_path)
    local_path = f'/tmp/{path.name}'
    client.download_file(path.bucket, path.key, local_path, ExtraArgs={'ExpectedBucketOwner': ACCOUNT_ID})
    return local_path


def upload_file_to_s3(s3_path: str, filepath: str) -> str:
    """
    Uploads modified local file to Amazon S3.
    
    :param s3_path: S3 URI of the original file 
    :type s3_path: str
    :param filepath: Path for the local modified file.
    :type filepath: str
    :return: The S3 URI for the modified answers file.
    :rtype: str
    """
    logger.info('Uploading file to S3')
    path = S3Path(s3_path)
    answers_key = f'answers/{path.stem}_answers{path.suffix}'
    client.upload_file(filepath, path.bucket, answers_key, ExtraArgs={'ExpectedBucketOwner': ACCOUNT_ID})
    return f's3://{path.bucket}/{answers_key}'