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

class Question(BaseModel):
    question: str = Field(description='The question or information request text')
    answer_cell: str = Field(
        description='Full Excel cell reference including sheet name (e.g., "Sheet1!A1", "Summary!B5")')


class Questions(BaseModel):
    questions: list[Question] = Field(
        default=[],
        description=(
            'List of all questions and information requests found in the RFP Excel sheet with their corresponding answer cell locations. '
            'Empty list if no questions or information requests are found.')
    )