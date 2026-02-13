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

FROM public.ecr.aws/docker/library/python:3.14-slim

WORKDIR /app

COPY requirements.txt requirements.txt

RUN apt-get update && apt-get -y install build-essential libpq-dev gcc git xz-utils curl

# Download latest nodejs binary
RUN curl https://nodejs.org/dist/v24.12.0/node-v24.12.0-linux-arm64.tar.xz -O

# Extract & install nodejs
RUN tar -xf node-v24.12.0-linux-arm64.tar.xz
RUN ln -s /app/node-v24.12.0-linux-arm64/bin/node /usr/local/bin/node
RUN ln -s /app/node-v24.12.0-linux-arm64/bin/npm /usr/local/bin/npm
RUN ln -s /app/node-v24.12.0-linux-arm64/bin/npx /usr/local/bin/npx

# Install from requirements file
RUN pip install -r requirements.txt

# Set AWS region environment variable
ENV AWS_REGION=us-west-2
ENV AWS_DEFAULT_REGION=us-west-2

# Signal that this is running in Docker for host binding logic
ENV DOCKER_CONTAINER=1

# Create non-root user
RUN useradd -m -u 1000 bedrock_agentcore
USER bedrock_agentcore

EXPOSE 8080

# Copy entire project (respecting .dockerignore)
COPY . .

# Use the full module path - pointing to our agent's entrypoint
CMD ["opentelemetry-instrument", "python", "-m", "index"]