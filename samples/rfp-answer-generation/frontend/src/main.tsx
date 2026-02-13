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

import { Authenticator } from "@aws-amplify/ui-react";
import React from "react";
import ReactDOM from "react-dom/client";
import {
  LoaderFunction,
  Route,
  RouterProvider,
  createBrowserRouter,
  createRoutesFromElements,
  defer,
} from "react-router-dom";

import { getJobs } from "@/lib/api";
import "./index.css";

import Error from "@/routes/Errors";
import Home from "@/routes/Home";
import Root from "@/routes/Root";
import FullWidthRoot from "@/routes/FullWidthRoot";
import { RequireAuth } from "./components/RequireAuth";
import { Login } from "./routes/Login";
import { Toaster } from "./components/ui/toaster";
import Job from "./routes/Job";
import { SpreadsheetProvider } from "./context/SpreadsheetContext";

const jobListLoader: LoaderFunction = function () {
  return defer({ jobs: getJobs() });
};

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route errorElement={<Error />}>
      <Route
        element={
          <RequireAuth>
            <Root />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} loader={jobListLoader} />
      </Route>
      <Route
        element={
          <RequireAuth>
            <FullWidthRoot />
          </RequireAuth>
        }
      >
        <Route path="jobs/:jobId" element={<Job />} />
      </Route>
      <Route path="login" element={<Login />} />
    </Route>,
  ),
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Authenticator.Provider>
      <SpreadsheetProvider>
        <Toaster />
        <RouterProvider router={router} />
      </SpreadsheetProvider>
    </Authenticator.Provider>
    
  </React.StrictMode>,
);
