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

from typing import Literal

from pydantic import BaseModel, Field


class Job(BaseModel):
    job_id: str = Field(
        description="Unique identifier for the job"
    )

    status: Literal['RUNNING', 'SUCCEEDED', 'FAILED'] = Field(
        description="Current job status. Possible values: RUNNING, SUCCEEDED, FAILED"
    )

    input_s3_uri: str = Field(
        description="S3 URI for the input RFP document"
    )

    output_s3_uri: str | None = Field(
        description="S3 URI for the output RFP document with answers"
    )

    created_at: str = Field(
        description="Job creation timestamp in ISO 8601 format (UTC)",
    )

    updated_at: str = Field(
        description="Job last update timestamp in ISO 8601 format (UTC)",
    )
