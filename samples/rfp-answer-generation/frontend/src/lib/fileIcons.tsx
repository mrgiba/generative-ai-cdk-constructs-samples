//
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
// with the License. A copy of the License is located at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
// OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
// and limitations under the License.
//

import { FileSpreadsheet, FileText, FileJson, File } from 'lucide-react';
import { cn } from './utils';

export type FileType = 'excel' | 'csv' | 'json' | 'pdf' | 'text' | 'unknown';

export function getFileType(filename: string): FileType {
  const ext = filename.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'xlsx':
    case 'xls':
    case 'xlsm':
    case 'xlsb':
      return 'excel';
    case 'csv':
      return 'csv';
    case 'json':
      return 'json';
    case 'pdf':
      return 'pdf';
    case 'txt':
    case 'md':
      return 'text';
    default:
      return 'unknown';
  }
}

export function getFileIconColor(fileType: FileType): string {
  switch (fileType) {
    case 'excel':
      return 'text-green-600 dark:text-green-500';
    case 'csv':
      return 'text-emerald-600 dark:text-emerald-500';
    case 'json':
      return 'text-amber-600 dark:text-amber-500';
    case 'pdf':
      return 'text-red-600 dark:text-red-500';
    case 'text':
      return 'text-blue-600 dark:text-blue-500';
    default:
      return 'text-muted-foreground';
  }
}

interface FileIconProps {
  filename: string;
  className?: string;
}

export function FileIcon({ filename, className }: FileIconProps) {
  const fileType = getFileType(filename);
  const colorClass = getFileIconColor(fileType);
  const iconClass = cn('h-4 w-4', colorClass, className);

  switch (fileType) {
    case 'excel':
      return <FileSpreadsheet className={iconClass} />;
    case 'csv':
      return <FileText className={iconClass} />;
    case 'json':
      return <FileJson className={iconClass} />;
    case 'pdf':
      return <FileText className={iconClass} />;
    case 'text':
      return <FileText className={iconClass} />;
    default:
      return <File className={iconClass} />;
  }
}
