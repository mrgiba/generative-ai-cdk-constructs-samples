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


from pydantic import BaseModel, Field

class Answer(BaseModel):
    answer: str = Field(
        description='The answer in plain text.'
    )

    comment: str | None = Field(
        None,
        description='If the context retrieved was insufficient or partially sufficient, this field explains what was found missing.'
    )
