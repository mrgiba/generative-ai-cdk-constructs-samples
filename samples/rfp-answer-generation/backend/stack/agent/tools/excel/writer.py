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

import openpyxl
from openpyxl.comments import Comment

class ExcelWriter:
    """
    Writes question answers to an RFP Excel file.
    """
    def __init__(self, filepath):
        self.workbook = openpyxl.load_workbook(filepath)
        self.filepath = filepath

    def write_answers(self, answers):
        for answer in answers:
            sheet_name, cell_address = answer['cell'].split('!')
            sheet = self.workbook[sheet_name]
            sheet[cell_address] = answer['answer']
            
            if answer['comment']:
                comment = Comment(answer['comment'], "RFP Answering Agent")
                sheet[cell_address].comment = comment

        self.workbook.save(self.filepath)
