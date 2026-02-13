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

import base64
import boto3
import datetime
import json
import logging
import os

from decimal import Decimal
from typing import TypedDict, Literal

from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get("LOG_LEVEL", "WARNING").upper())

dynamodb = boto3.resource("dynamodb")
jobs_table = dynamodb.Table(os.environ["JOBS_TABLE"])

class Job(TypedDict):
    job_id: str
    status: Literal['RUNNING', 'SUCCEEDED', 'FAILED']
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


def encode_pagination_token(last_evaluated_key):
    """Encode DynamoDB LastEvaluatedKey as base64 token"""
    if not last_evaluated_key:
        return None
    
    # Convert Decimal values to strings for JSON serialization
    serializable_key = {}
    for key, value in last_evaluated_key.items():
        if isinstance(value, Decimal):
            serializable_key[key] = str(value)
        else:
            serializable_key[key] = value
    
    token_str = json.dumps(serializable_key, sort_keys=True)
    return base64.b64encode(token_str.encode()).decode()


def decode_pagination_token(token):
    """Decode base64 token back to DynamoDB ExclusiveStartKey"""
    if not token:
        return None
    
    try:
        token_str = base64.b64decode(token.encode()).decode()
        return json.loads(token_str)
    except Exception as e:
        logger.error(f"Invalid pagination token: {e}")
        raise ValueError("Invalid pagination token")


def validate_items_parameter(items_str):
    items = int(items_str)
    if items < 1 or items > 100:
        raise ValueError("Items must be between 1 and 100")


def validate_str_input(input_str: str, param_name: str) -> str:
    import re
    if not input_str or len(input_str) > 100:
        raise ValueError(f"Invalid {param_name}: must be non-empty and <= 100 characters")
    
    # Validate UUID format for job_id parameters
    if param_name == "job_id" and not re.match(r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$', input_str.lower()):
        raise ValueError(f"Invalid {param_name}: must be a valid UUID format")
    
    # Sanitize input - remove potentially dangerous characters
    if re.search(r'[<>"\';\\]', input_str):
        raise ValueError(f"Invalid {param_name}: contains prohibited characters")
    
    return input_str


def handler(event, _context):
    response = {
        "headers": {
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
        }
    }

    try:
        logger.debug(event)
        
        query_params = event.get("queryStringParameters") or {}
        items = query_params.get("items", "20")
        validate_items_parameter(items)
        
        next_token = query_params.get("nextToken")
        
        exclusive_start_key = None
        if next_token:
            exclusive_start_key = decode_pagination_token(next_token)
        
        scan_kwargs = {
            "IndexName": "UpdatedAtSecondaryIndex",
            "Limit": int(items)
        }
        
        if exclusive_start_key:
            scan_kwargs["ExclusiveStartKey"] = exclusive_start_key
        
        ddb_response = jobs_table.scan(**scan_kwargs)
        last_evaluated_key = ddb_response.get("LastEvaluatedKey")
        
        result = {
            "items": ddb_response.get("Items", [])
        }
        
        if last_evaluated_key:
            result["nextToken"] = encode_pagination_token(last_evaluated_key)
        
        response["statusCode"] = 200
        response["body"] = json.dumps(result, cls=OutputEncoder)

        return response
        
    except (KeyError, ValueError) as exception:
        logger.error(exception, exc_info=True)
        response["statusCode"] = 400
        return response
    except ClientError as exception:
        logger.error(exception, exc_info=True)
        response["statusCode"] = 500
        return response
