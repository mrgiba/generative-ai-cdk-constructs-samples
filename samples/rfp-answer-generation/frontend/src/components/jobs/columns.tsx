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

import { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import { ArrowUpDown } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "@/components/ui/badge";
import { FileIcon } from "@/lib/fileIcons";

import { Job } from "@/lib/types";

export const columns: ColumnDef<Job>[] = [
  {
    accessorKey: "job_id",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Job ID
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const { job_id } = row.original;


      return (
        <Link
          to={`/jobs/${job_id}`}
          className="flex items-center gap-2"
        >
          <span className="font-medium text-slate-600">{job_id}</span>
        </Link>
      );
    },
  },
  {
    accessorKey: "updated_at",
    header: ({ column }) => {
      return (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Updated
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      );
    },
    cell: ({ row }) => {
      const rowDate = row.getValue("updated_at");
      if (rowDate) {
        const date = new Date(rowDate as string);
        return (
          <div className="flex justify-center">{date.toLocaleString()}</div>
        );
      }
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => {
      return (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Status
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      );
    },
    cell: ({ row }) => {
      const status = row.getValue<string>("status");

      const statusDictionary: { [key: string]: string } = {
        RUNNING: "Processing",
        SUCCEEDED: "Finished",
        FAILED: "Failed",
        TIMED_OUT: "Failed",
        ABORTED: "Canceled",
      };

      const statusClassNames: { [key: string]: string } = {
        RUNNING: "bg-black hover:bg-black animate-pulse",
        SUCCEEDED: "bg-lime-600 hover:bg-lime-600",
        FAILED: "bg-red-600 hover:bg-red-600",
        TIMED_OUT: "bg-red-600 hover:bg-red-600",
        ABORTED: "bg-slate-600 hover:bg-slate-600",
      };

      return (
        <div className="flex justify-center">
          <Badge
            className={`h-auto py-0 text-[10px] uppercase ${statusClassNames[status]}`}
          >
            {statusDictionary[status]}
          </Badge>
        </div>
      );
    },
  },
  {
    accessorKey: "input_s3_uri",
    header: ({ column }) => {
      return (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Input File
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      );
    },
    cell: ({ row }) => {
      const input_s3_uri = row.getValue<string>("input_s3_uri");
      const file_name = input_s3_uri.split("/").at(-1) || "";

      return (
        <div className="flex items-center justify-center gap-2">
          <FileIcon filename={file_name} />
          <span>{file_name}</span>
        </div>
      );
    },
  },
];
