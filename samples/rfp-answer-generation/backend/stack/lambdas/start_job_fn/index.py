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
import json
import hashlib
import logging
import os

logger = logging.getLogger(__name__)
logger.setLevel(os.environ.get("LOG_LEVEL", "WARNING").upper())

AGENT_RUNTIME_ARN = os.environ["AGENT_RUNTIME_ARN"]

agent_core_client = boto3.client('bedrock-agentcore')
  
def handler(event, _context):
    if 'Records' in event:
        for record in event['Records']:
            event_type: str = record['eventName']
            bucket: str = record['s3']['bucket']['name']
            object_key: str = record['s3']['object']['key']

            logger.info(f'{event_type}, {bucket}, {object_key}')

            s3_uri = f"s3://{bucket}/{object_key}"

            payload = json.dumps({"s3_path": s3_uri}).encode()
            session_hash = hashlib.sha256(f"{bucket}/{object_key}".encode()).hexdigest()[:8]
            response = {
                "message": "",
                "status": "OK",
                "session_id": f"{bucket}/{object_key}_{session_hash}"
            }
    
            try:
                agent_response = agent_core_client.invoke_agent_runtime(
                    agentRuntimeArn=AGENT_RUNTIME_ARN,
                    runtimeSessionId=response['session_id'],
                    payload=payload
                )

                # Handle standard JSON response
                content = []
                for chunk in agent_response.get("response", []):
                    content.append(chunk.decode('utf-8'))

                response['message'] = ''.join(content)
            except Exception as e:
                logger.error(e, exc_info=True)
                response['message'] = "There was an error with your request. Please try again."
                response['status'] = "ERROR"

            return response
