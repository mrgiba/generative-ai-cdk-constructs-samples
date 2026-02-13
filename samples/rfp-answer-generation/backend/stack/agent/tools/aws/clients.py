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
import boto3
import logging

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

logger = logging.getLogger(__name__)
logger.setLevel(LOG_LEVEL)

SESSION = boto3.Session()

def get_session() -> boto3.Session:
    return SESSION

def get_s3_client(region_name: str | None):
    """
    Create a boto3 S3 client using credentials from environment variables. Falls back to 'us-west-2' if no region is specified or found in environment.
    
    :param region_name: AWS Region name.
    :type region_name: str | None
    """
    # Use provided region, or get from env, or fall back to us-west-2
    region = region_name or os.getenv('AWS_REGION') or 'us-west-2'

    # Create a new session to force credentials to reload
    # so that if user changes credential, it will be reflected immediately in the next call
    SESSION = boto3.Session()

    # boto3 will automatically load credentials from environment variables:
    # AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN
    return SESSION.client('s3', region_name=region)


def get_sts_client(region_name: str | None):
    """
    Create a boto3 STS client using credentials from environment variables. Falls back to 'us-west-2' if no region is specified or found in environment.

    :param region_name: AWS Region name.
    :type region_name: str | None
    """
    region = region_name or os.getenv('AWS_REGION') or 'us-west-2'
    SESSION = boto3.Session()
    return SESSION.client('sts', region_name=region)


def get_dynamodb_client(region_name: str | None):
    """
    Create a boto3 DynamoDB client using credentials from environment variables. Falls back to 'us-west-2' if no region is specified or found in environment.
    
    :param region_name: AWS Region name.
    :type region_name: str | None
    """
    # Use provided region, or get from env, or fall back to us-west-2
    region = region_name or os.getenv('AWS_REGION') or 'us-west-2'

    # Create a new session to force credentials to reload
    # so that if user changes credential, it will be reflected immediately in the next call
    SESSION = boto3.Session()

    # boto3 will automatically load credentials from environment variables:
    # AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN
    return SESSION.client('dynamodb', region_name=region)


def get_bedrock_kb_client(region_name: str | None):
    """
    Create a boto3 Bedrock Agents Runtime client using credentials from environment variables. Falls back to 'us-west-2' if no region is specified or found in environment.
    
    :param region_name: AWS Region name.
    :type region_name: str | None
    """
    # Use provided region, or get from env, or fall back to us-west-2
    region = region_name or os.getenv('AWS_REGION') or 'us-west-2'

    # Create a new session to force credentials to reload
    # so that if user changes credential, it will be reflected immediately in the next call
    SESSION = boto3.Session()

    # boto3 will automatically load credentials from environment variables:
    # AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN
    return SESSION.client('bedrock-agent-runtime', region_name=region)