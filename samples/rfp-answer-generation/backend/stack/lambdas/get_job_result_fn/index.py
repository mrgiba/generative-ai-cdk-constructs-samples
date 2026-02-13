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

import boto3
import datetime
import json
import logging
import os
import re

from decimal import Decimal
from typing import TypedDict, Literal
from botocore.exceptions import ClientError

from cloudpathlib import S3Path

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get("LOG_LEVEL", "WARNING").upper())

jobs_table = boto3.resource("dynamodb").Table(os.environ["JOBS_TABLE"])
s3_client = boto3.client("s3")
sts_client = boto3.client("sts")
ACCOUNT_ID = sts_client.get_caller_identity()["Account"]


class Job(TypedDict):
    job_id: str
    status: Literal["RUNNING", "SUCCEEDED", "FAILED"]
    input_s3_uri: str
    output_s3_uri: str | None
    created_at: str
    updated_at: str


class OutputEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj)
        if isinstance(obj, datetime.datetime):
            return obj.isoformat()
        return json.JSONEncoder.default(self, obj)


def validate_str_input(input: str):
    if not input or len(input) > 100:
        raise ValueError("Invalid input: must be non-empty and <= 100 characters")
    
    # Validate UUID format for job_id
    if not re.match(r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$', input.lower()):
        raise ValueError("Invalid job_id: must be a valid UUID format")
    
    # Sanitize input - check for dangerous characters
    if re.search(r'[<>"\';\\]', input):
        raise ValueError("Invalid input: contains prohibited characters")
    
    return input


def get_job_info(job_id: str) -> Job:
    response = jobs_table.get_item(Key={"job_id": job_id})
    info = response.get("Item", {})

    return info


def handler(event, _context):
    response = {
        "headers": {
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
        }
    }

    presigned_url = None

    try:
        logger.debug(event)
        job_id: str = event["pathParameters"]["job_id"]
        validate_str_input(job_id)
        job_info = get_job_info(job_id)

        if "output_s3_uri" in job_info and job_info["output_s3_uri"]:
            path = S3Path(job_info["output_s3_uri"])
            presigned_url = s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": path.bucket, "Key": path.key, "ExpectedBucketOwner": ACCOUNT_ID},
                ExpiresIn=3600,  # 1 hour
            )
            s3_uri_file_name = S3Path(job_info["output_s3_uri"]).name

    except (KeyError, ValueError) as exception:
        logger.debug(exception, exc_info=True)
        response["statusCode"] = 400
        return response
    except ClientError as exception:
        logger.debug(exception, exc_info=True)
        response["statusCode"] = 500
        return response

    response["statusCode"] = 200
    response["body"] = json.dumps(
        {
            "job_id": job_info["job_id"],
            "status": job_info["status"],
            "filename": s3_uri_file_name,
            "presigned_url": presigned_url,
            "created_at": job_info["created_at"],
            "updated_at": job_info["updated_at"],
        },
        cls=OutputEncoder,
    )
    return response
