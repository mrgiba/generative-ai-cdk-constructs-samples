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

import logging
import os
from string import Template
import sys
import yaml

from model.config import AgentConfig

FAQ_KNOWLEDGE_BASE = os.environ.get("FAQ_KNOWLEDGE_BASE")
SUPPORTING_DOC_KNOWLEDGE_BASE = os.environ.get("SUPPORTING_DOC_KNOWLEDGE_BASE")

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stdout,
)

logger = logging.getLogger(__name__)


def load_config() -> AgentConfig:
    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "config.yaml")) as file:
        try:
            template = file.read()
            config = Template(template).substitute({
                'FAQ_KNOWLEDGE_BASE': FAQ_KNOWLEDGE_BASE,
                'SUPPORTING_DOC_KNOWLEDGE_BASE': SUPPORTING_DOC_KNOWLEDGE_BASE,
            })
            content = yaml.safe_load(config)
        except yaml.YAMLError as exc:
            logger.info(exc)
            content = None

    return AgentConfig(**content["config"])