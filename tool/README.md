# Project description

This repository contains the neccessary materials to replicate Love Ahnström's master thesis.

# Prerequisites:

- Node.js (tested on v22.7.0) https://nodejs.org/en and NPM (or your node package manager of choice)
- Required packages must be installed using `npm install`
- The clinicaltrials.gov database downloaded as separate json files. You can download the files here: https://clinicaltrials.gov/search . To download, press the download button, select JSON file format, check "Put each study into a separate file and download them as a zip archive", select all studies, select all available data fields, and download. The zip file needs to be extracted. Please put the extracted folder containing the JSON files in the root of this directory and name it "ctg-studies.json".
- An offline copy of the Pubmed database, as created in the src/download_pubmed.js file. First, all pubmed files must be downloaded with ftp, please refer to https://pubmed.ncbi.nlm.nih.gov/download/. The "baseline" and "updatefiles" folders must be downloaded in their entirety. All .gz files in it must be extracted (using your method of choice). The contents of the baseline and updatefiles folders must be merged into a single folder. The inputDir and outputDir variables in download_pubmed.js must be changed to locations on your machine, where inputDir points to the directory with the extracted .xml files from pubmed.
- An api key from OpenAI must be created, please refer to their documentation. Credits must be added to your account. This key must be saved to the environment variable OPENAI_API_KEY
- An api key from Serper.dev must be created, please refer to their documentation. Credits must be added to your account. This key must be saved to the environment variable SERPER_API_KEY

# How to run
- 
- Run the files in src/batch_processing in order