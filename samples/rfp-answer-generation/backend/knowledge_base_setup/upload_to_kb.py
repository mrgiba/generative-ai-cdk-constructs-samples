#
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
# with the License. A copy of the License is located at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
# OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
# and limitations under the License.
#

"""
Knowledge Base Document Upload Script

Uploads documents and their metadata to an S3 bucket for Knowledge Base ingestion.
Reads documents.csv and for each entry:
- Uploads the document file to S3
- Creates and uploads a metadata JSON file with merchant and lastModified information

Usage: python upload_to_kb.py <bucket_name>
"""

import csv
import json
import sys
from datetime import datetime
from pathlib import Path

import boto3


def main():
    if len(sys.argv) != 2:
        print('Usage: python upload_to_kb.py <bucket_name>')
        sys.exit(1)

    bucket_name = sys.argv[1]
    s3 = boto3.client('s3')
    sts = boto3.client('sts')
    account_id = sts.get_caller_identity()['Account']

    with open('documents.csv', 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            filepath = Path(row['filepath'])
            filename = filepath.name

            # Upload file
            s3.upload_file(
                str(filepath),
                bucket_name,
                filename,
                ExtraArgs={'ExpectedBucketOwner': account_id}
            )

            # Create and upload metadata
            epoch = int(datetime.strptime(row['lastModified'], '%Y-%m-%d').timestamp())
            metadata = {
                'metadataAttributes': {
                    'lastModified': row['lastModified'],
                    'timestamp': epoch,
                    'merchant': row['merchant']
                }
            }
            metadata_filename = f'{filename}.metadata.json'
            s3.put_object(
                Bucket=bucket_name,
                Key=metadata_filename,
                Body=json.dumps(metadata),
                ExpectedBucketOwner=account_id
            )

            print(f'Uploaded {filename} and {metadata_filename}')


if __name__ == '__main__':
    main()
