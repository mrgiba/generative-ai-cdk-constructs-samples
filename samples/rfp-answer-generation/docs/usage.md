# Usage

## Data

### RFP Files

RFP files are XLSX and/or CSV files containing questions from a merchant requesting information about a service your company is providing. The data doesn't need to be formatted in a specific way. During both ingestion and inference, this project uses Large Language Models (LLMs) to process these files to extract the necessary information used in the solution.

Sometimes RFP files can contain multiple sheets as well as a large number of questions per sheet. This can pose a challenge during file processing: LLMs have a limited output token count, which means if we try to extract too much information at once, some of it can end up getting cut off the model response. Refer to [Anthropic Model Comparison Table](https://docs.anthropic.com/en/docs/about-claude/models#model-comparison-table) for more information on max output tokens.

To avoid this issue, this project divides RFP files in sheets, then in sections inside the sheets. A section is separated by a blank/null line in the sheet. This can be a blank line after a group of questions or after an information topic.

If you feel your RFP files have long blocks of content and wish to avoid information loss, you can insert a blank line between question groups to ensure all of them get processed.

### Supporting documents

Supporting documents are PDF files with company regulations and other relevant information that might need to be used to answer RFP questions. These can be created by converting text documents with protocols and policies, or PPTX presentations with relevant company information. All relevant information is extracted from the documents and stored into a supporting documentation Knowledge Base.

### Example files

You can find anonymized sample RFP and document files under the `docs/samples` folder.

## Using the solution

### Add documents to the Knowledge Base

Once you [deploy the Ingestion stack](../backend/README.md), you will need to add documents to the buckets. This solution provides a script that automatically adds your documents alongside the required metadata into one of the two Knowledge Bases. 

You can update `knowledge_base_setup/documents.csv` with the file paths, merchant information, and last modified dates for your documents. Each row should contain:
   - `filepath`: Absolute or relative path to the document file
   - `merchant`: Merchant or organization name associated with the document
   - `lastModified`: Last modification date in YYYY-MM-DD format

Example:
```csv
filepath,merchant,lastModified
/path/to/product-catalog.pdf,ACME Corp,2025-12-15
../docs/terms-and-conditions.pdf,ACME Corp,2026-01-10
faq-shipping.pdf,Global Logistics,2025-11-20
```

You can then run the script to upload all files. The script requires you to specify the name of the bucket you wish to upload files to. You can find out the name of the bucket created by the stack by running:

```shell
$ aws cloudformation describe-stacks --stack-name RFPAnswers-IngestionStack --query "Stacks[0].Outputs[?contains(OutputKey, 'IngestionBucketFAQ')].OutputValue"

[
    "OutputValue": "bucket-name"
]
```

You can add your existing supporting documents to the `IngestionBucketSupportingDocs` bucket. You can find out the name of the created bucket by running:

```shell
$ aws cloudformation describe-stacks --stack-name RFPAnswers-IngestionStack --query "Stacks[0].Outputs[?contains(OutputKey, 'IngestionBucketSupportingDocs')].OutputValue"

[
    "OutputValue": "bucket-name"
]
```

You can bring your own documents, or use the ones provided in the `docs/samples` folder. You can find previously answered RFPs for a ficticious company, **Oktank**, in the `docs/samples/RFPs/answered` folder, and the accompanying supporting PDF documents in the `docs/samples/documents` folder.

### Sync the Knowledge Base

Each time you add, modify, or remove files from the data buckets, you must sync the Knowledge Base data sources so that they are re-indexed to the knowledge base. Syncing is incremental, so Amazon Bedrock only processes added, modified, or deleted documents since the last sync.

To ingest your data into your knowledge base and sync with your latest data:

1. Open the Amazon Bedrock console at https://console.aws.amazon.com/bedrock/

2. From the left navigation pane, select Knowledge base and choose either the FAQ knowledge base or the Docs knowledge base.

3. In the Data source section, select Sync to begin data ingestion or syncing your documents. To stop a data source currently syncing, select Stop. A data source must be currently syncing in order to stop syncing the data source. You can select Sync again to ingest the rest of your data.

4. When data ingestion completes, a green success banner appears if it is successful.

You can choose a data source to view its Sync history. Select View warnings to see why a data ingestion job failed.

### Add users to Cognito User Pool

If you wish to use the provided sample API, you must first create a Cognito user so that you can authenticate your API requests.

To create an user, locate the Cognito User Pool ID using the AWS Command Line Interface (AWS CLI):

```shell
$ aws cloudformation describe-stacks --stack-name RFPAnswers-InferenceStack --query "Stacks[0].Outputs[?contains(OutputKey, 'UserPoolId')].OutputValue"

[
    "OutputValue": "<region>_a1aaaA1Aa"
]
```

You can then go the Amazon Cognito page at the AWS Management Console, search for the User Pool and add users.

### Interact with the application

You can use the sample User Interface provided in the `frontend` folder as an example of how to interact with this application.

> We do not recommend having this web application in production or publicly accessible as-is. The user interface was created for demo purposes only. The work is provided **AS IS** without warranties or conditions of any kind, either express or implied, including warranties or conditions of merchantability. You bear the risks of using the package.

The application allows the user to process their own RFP files, view existing processing jobs for RFPs, and interact with answers generated by the LLM. 

You can bring your own RFP files, or, like in the ingestion process, use the ones provided in the `docs/samples` folder. You can find non-answered RFPs for the ficticious **Oktank** company in the `docs/samples/RFPs/only_questions` folder.

The first screen of the application consists of a table containing all files already processed. You can process a file multiple times. The table contains the status of the file processing job (whether it's running, it has succeeded or failed) and the date it was processed. 

For the scope of this solution, you cannot delete a job from the user interface. You can implement your own endpoint for that or manually delete all job instances from the DynamoDB table. 

By clicking a table entry, you will be redirected to the job edition screen. You will see an excel file viewer and the Agent's answers to your RFP questions.

You can edit the file and download it.

## Customizing the solution

### Config File

This solution contains a vanilla configuration file for the question-answering agent.

```
config:
  version: 0.0.1
  name: RFP Agent Config
  language: English
  models:
    reader: us.anthropic.claude-haiku-4-5-20251001-v1:0
    answers: us.anthropic.claude-sonnet-4-5-20250929-v1:0
    context: us.anthropic.claude-haiku-4-5-20251001-v1:0
  knowledge_bases:
    - id: ${FAQ_KNOWLEDGE_BASE}
      description: Knowledge Base containing previously answered RFPs. The KB chunks are question-answer pairs.
      results: 10
      limit_date_lookback: 5 years
    - id: ${SUPPORTING_DOC_KNOWLEDGE_BASE}
      description: Knowledge Base containing supporting documentation. The KB chunks are fixed-length document chunks.
      results: 5
      limit_date_lookback: 2 years
    # you can add additional KBs following this format.
```

This configuration file allows you to set different models for tasks such as reading RFP content, fetching context, and answering questions. To change the models, replace the model ID with one of the [Supported Models in Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html).

This configuration file also allows you to set different Knowledge Bases (KB) that will be queried when answering questions. The 2 Knowledge Bases configured here are the ones provided with this solution. You can add your own KBs by adding new entries to this list. You can configure the number of chunks retrieved from the KB as well as a cutoff date for fetching records for each separate KB.

### LLM Prompts

This solution includes prompts tested with a few types of RFP, mainly for contract providers. They were created using [Anthropic's Prompt Engineering recommended practices](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview). We encourage you to customize the prompts and try out other techniques that might tailor to your use case:

- You can find the ingestion/question extraction prompt at `backend/stack/lambdas/custom_chunking_handler_fn/app/processor.py`
- You can find the question-answering prompt in the context agent tool at `backend/stack/agent/tools/context/agent.py`

### Using other LLMs

This solution is configured to use Anthropic Claude 3.5 Sonnet v1. Should you wish to try out other models to see how they perform for your specific use case, you can follow these steps to update the model.

**Ingestion**

1. Open file `backend/stack/ingestion_stack.py`. On `line 161`, update the resource permissions to the model you wish to use. The list of model ids available through Amazon Bedrock is available in the [Amazon Bedrock documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html).

2. Open file `backend/stack/lambdas/custom_chunking_handler_fn/app/handler.py`. On `line 29`, substitute the value for `MODEL_ID` for the model ID you wish to use.

**Inference**

1. Open file `backend/stack/stack_constructs/sfn_step_answer_question.py`. On `line 69`, update the resource permissions to the model you wish to use. The list of model ids available through Amazon Bedrock is available in the [Amazon Bedrock documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html).

2. Open file `backend/stack/lambdas/answer_question_fn/app/chain.py`. On `line 28`, substitute the value for `BEDROCK_MODEL_ID` for the model ID you wish to use.
