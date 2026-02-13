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

from mcp import stdio_client, StdioServerParameters
from strands.tools.mcp import MCPClient

# Create MCP client with stdio transport
excel_mcp_client = MCPClient(lambda: stdio_client(
    StdioServerParameters(
        command="npx",
        args=["--yes", "@negokaz/excel-mcp-server"],
        env={
            "EXCEL_MCP_PAGING_CELLS_LIMIT": "4000"
        }
    )
))
