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

import { useParams, Link } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { IconAlertTriangle } from "@tabler/icons-react";
import { Info, Hash, CheckCircle2, Calendar, Clock, Copy, Check } from "lucide-react";

import { SpreadsheetViewer } from "@/components/spreadsheet";
import { Spinner } from "@/components/ui/spinner";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { getJobInfo } from "@/lib/api";

interface JobData {
  job_id: string;
  status: string;
  filename: string;
  presigned_url: string;
  created_at: string;
  updated_at: string;
}

function JobInfoButton({ jobData, loading }: { jobData: JobData | null; loading: boolean }) {
  const [jobIdCopied, setJobIdCopied] = useState(false);

  const handleCopyJobId = useCallback(async () => {
    if (!jobData?.job_id) return;
    try {
      await navigator.clipboard.writeText(jobData.job_id);
      setJobIdCopied(true);
      setTimeout(() => setJobIdCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy job ID:', err);
    }
  }, [jobData?.job_id]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="inline-flex items-center justify-center h-8 w-8">
        <Spinner className="size-4" />
      </div>
    );
  }

  if (!jobData) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 w-8 border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
          aria-label="Job information"
        >
          <Info className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 py-3 border-b">
          <h4 className="font-semibold leading-none">Job Details</h4>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3 h-8">
            <div className="rounded-md bg-muted p-1.5">
              <Hash className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium w-24">Job ID</p>
            <div className="flex-1 flex justify-end items-center gap-1">
              <code className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                {jobData.job_id.length > 16
                  ? `${jobData.job_id.slice(0, 6)}...${jobData.job_id.slice(-6)}`
                  : jobData.job_id}
              </code>
              <button
                onClick={handleCopyJobId}
                className="p-1 rounded hover:bg-muted transition-colors"
                aria-label="Copy job ID"
              >
                {jobIdCopied ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 h-8">
            <div className="rounded-md bg-muted p-1.5">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium w-24">Status</p>
            <div className="flex-1 flex justify-end">
              <Badge
                variant={jobData.status === 'SUCCEEDED' ? 'default' : 'secondary'}
                className={jobData.status === 'SUCCEEDED' ? 'bg-green-600 hover:bg-green-600' : ''}
              >
                {jobData.status}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-3 h-8">
            <div className="rounded-md bg-muted p-1.5">
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium w-24">Created</p>
            <p className="text-xs text-muted-foreground flex-1 text-right">{formatDate(jobData.created_at)}</p>
          </div>
          <div className="flex items-center gap-3 h-8">
            <div className="rounded-md bg-muted p-1.5">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium w-24">Updated</p>
            <p className="text-xs text-muted-foreground flex-1 text-right">{formatDate(jobData.updated_at)}</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function Job() {
  const { jobId } = useParams<{ jobId: string }>();
  const [jobData, setJobData] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchJobData() {
      if (!jobId) return;

      try {
        setLoading(true);
        setError(null);
        const data = await getJobInfo(jobId);
        setJobData(data);
      } catch (err) {
        console.error("Failed to fetch job data:", err);
        setError("Failed to load job data");
      } finally {
        setLoading(false);
      }
    }

    fetchJobData();
  }, [jobId]);

  return (
    <div className="h-full flex flex-col">
      {/* Header - always visible with jobId from URL */}
      <div className="px-4 py-2 border-b bg-background flex items-center justify-between">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Jobs</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{jobId}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <JobInfoButton jobData={jobData} loading={loading} />
      </div>

      {/* Error state */}
      {error && (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="flex flex-col items-center gap-4 p-8 animate-fade-in">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <IconAlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-lg font-semibold text-foreground">Failed to load job</span>
              <span className="text-sm text-muted-foreground max-w-sm">{error}</span>
            </div>
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mt-2"
            >
              Back to Jobs
            </Link>
          </div>
        </div>
      )}

      {/* Spreadsheet viewer - always rendered, handles its own loading states */}
      {!error && (
        <div className="flex-1 overflow-hidden">
          <SpreadsheetViewer
            url={jobData?.presigned_url}
            filename={jobData?.filename}
          />
        </div>
      )}
    </div>
  );
}
