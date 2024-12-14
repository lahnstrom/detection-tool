library(dplyr)
library(stringr)

############# EVALUATION OF TOOL CHARACTERISTICS - VALIDATION_DATASET ###############

perf_df <- read.csv('./data/validation_run_all_1.csv')

# Due to some trials being missed in first run, they were run in a separate batch job and added back here
perf_df_amend <- read.csv('./data/validation_run_all_1_missed.csv')
perf_df <- perf_df %>% bind_rows(perf_df_amend)

validation_df <- read.csv('./out/validation_dataset.csv')

# TODO: Iv has some duplicates, will have to remove later
validation_df <- validation_df %>% 
  distinct(nct_id, .keep_all = TRUE)

# Remove those with multiple nctid (They are separated by ;)
validation_df <- validation_df %>%
  filter(!grepl(";", nct_id))

df <- left_join(perf_df, validation_df, by="nct_id")

# Convert "true" to T, "false" to F, "Yes" to T, and "No" to F in the specified columns
df <- df %>% 
  mutate(across(c(tool_results, has_error, tool_truncated, has_publication, has_summary_results), ~ case_when(
    . == "true" ~ TRUE,
    . == "false" ~ FALSE,
    . == "Yes" ~ TRUE,
    . == "No" ~ FALSE,
    TRUE ~ as.logical(.)
  ))) %>%
  mutate(across(everything(), ~ ifelse(. == "null", "", .))) %>% 
  mutate(across(everything(), ~ ifelse(. == "undefined", "", .))) %>% 
  mutate(
    agree = has_publication == tool_results,
  )

n_total <- df %>% nrow() 

############## Publications detected vs actual ############

n_found_tool <- df %>% filter(tool_results) %>% nrow()
n_found_human <- df %>% filter(has_publication) %>% nrow()

############### CONFUSION MATRIX #############

n_pos <- df %>% filter(has_publication) %>% nrow()
n_neg <- df %>% filter(!has_publication) %>% nrow()

n_tool_pos <- df %>% filter(tool_results) %>% nrow()
n_tool_neg <- df %>% filter(!tool_results) %>% nrow()

ratio_pub_true <- n_pos / n_total
ratio_pub_tool <- n_tool_pos / n_total

sens_spec_df <- df %>% group_by(has_publication) %>% count(tool_results) 

true_pos <- df %>% filter(tool_results & has_publication)  %>% nrow()
false_pos <- df %>% filter(tool_results & !has_publication) %>% nrow()
true_neg <- df %>% filter(!tool_results & !has_publication)  %>% nrow()
false_neg <- df %>% filter(!tool_results & has_publication)  %>% nrow()

sens <- true_pos / (true_pos + false_neg)
spec <- true_neg / (true_neg + false_pos)
ppv = true_pos / (true_pos + false_pos)
npv = true_neg / (true_neg + false_neg)
f_score = 2 / sum(1 / c(ppv, sens))

############### EXTRA CHARACTERISTICS ################

df_has_publication <- df %>% filter(has_publication & publication_pmid != "")

n_with_pubmed_publication <- df_has_publication %>%  nrow()

df_has_publication <- df_has_publication %>%
  rowwise() %>%
  mutate(correct_pub_found = str_detect(tool_prompted_pmids, fixed(publication_pmid))) %>%
  ungroup()

df_has_publication <- df_has_publication %>%
  rowwise() %>%
  mutate(correct_classification = str_detect(tool_result_pmids, fixed(publication_pmid))) %>%
  ungroup()

n_correct_publication_found <- df_has_publication %>% filter(correct_pub_found) %>% nrow()
ratio_correct_pub <- n_correct_publication_found / n_with_pubmed_publication

n_classified_correctly <- df_has_publication %>% filter(correct_classification) %>% nrow()
ratio_correct_classification <- n_classified_correctly / n_with_pubmed_publication


############### PERFORMANCE FOR DIFFERENT IDENTIFICATION STEPS ################

df_linked <- df %>% filter(identification_step=='Linked at the registration')
df_google <- df %>% filter(identification_step=='Systematic Google search')

sens_spec_linked <- df_linked %>% group_by(has_publication) %>% count(tool_results) 
sens_spec_google <- df_google %>% group_by(has_publication) %>% count(tool_results) 

n_linked <- df_linked %>% nrow()
n_linked_found <- df_linked %>% filter(has_publication & tool_results) %>% nrow()
ratio_linked_found = n_linked_found / n_linked

n_google <- df_google %>% nrow()
n_google_found <- df_google %>% filter(has_publication & tool_results) %>% nrow()
ratio_google_found = n_google_found / n_google


############# EVALUATION OF DETECTION TOOL PERFORMANCE - RESULTS DETECTION ###############

# Provided a single publication with human-found article 
constructed_df_pos <- read.csv('./data/validation_run_17_constructed.csv')
# Provided a single publication with faked abstract by ChatGPT 4o
constructed_df_neg <- read.csv('./data/fake/validation_run_17_constructed.csv')

# Number of cases in each
n_pos_constructed <- constructed_df_pos %>% nrow()
n_neg_constructed <- constructed_df_neg %>% nrow()

# Number of true positives and true negatives
n_true_pos_constructed <- constructed_df_pos %>% filter(tool_results == 'true') %>% nrow()
n_true_neg_constructed <- constructed_df_neg %>% filter(tool_results == 'false') %>% nrow()

# Sensitivity/Specificity - all are positive and negative respectively
sens_constructed <- n_true_pos_constructed / n_pos_constructed
spec_constructed <- n_true_neg_constructed / n_neg_constructed

