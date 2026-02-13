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

import { Skeleton } from "../ui/skeleton";

export function RFPSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex w-full flex-col gap-2">
      {[...Array(rows)].map((_, index) => (
        <Skeleton key={index} className="h-[60px] w-full bg-gray-200" />
      ))}

      <Skeleton className="mt-3 h-[20px] w-[30%] rounded-full bg-gray-200" />
    </div>
  );
}
