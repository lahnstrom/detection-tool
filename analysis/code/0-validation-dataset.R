library(dplyr)

# IntoValue dataset
df_iv <- read.csv('./data/iv_main_dataset.csv')

# Nordic clinical trials dataset
df_nordic <- read.csv('./data/nordic_dataset.csv')

df_iv %>% group_by(completion_year) %>% summarise(n=n())
df_nordic %>% group_by(completion_year) %>% summarise(n=n())
df_iv %>% group_by(registry) %>% summarise(n=n())

# Identify the dates of the most recent publications in the respective datasets.
most_recent_date_iv <- max(df_iv$publication_date, na.rm = TRUE)
most_recent_date_nordic <- max(df_nordic$publication_date, na.rm = TRUE)

# Remap identification_step

df_iv %>% group_by(identification_step) %>% summarise(n=n())
df_nordic %>% group_by(identification_step) %>% summarise(n=n())

df_iv_remapped <- df_iv %>% mutate(
  identification_step = case_when(
    identification_step == "Abstract only" ~ "Other",
    identification_step == "Dissertation" ~ "Other",
    identification_step == "Hand search" ~ "Systematic Google search",
    identification_step == "No publ" ~ NA,
    identification_step == "Publ found in Google ID search" ~ "Systematic Google search",
    identification_step == "Publ found in Google search (no ID)" ~ "Systematic Google search",
    identification_step == "Pubmed" ~ "Other",
    identification_step == "Registry linked" ~ "Linked at the registration",
    TRUE ~ identification_step), 
  has_publication=ifelse(has_publication, "Yes", "No"), 
  has_summary_results=ifelse(has_summary_results, "Yes", "No"))

# Only CTGOV trials
df_iv_ctgov <- df_iv_remapped %>% filter(registry=="ClinicalTrials.gov")
df_nordic_ctgov <- df_nordic %>% filter(registered_ctgov=="Yes")

# Add dataset identifier
df_iv_id <- df_iv_ctgov %>% mutate(dataset="iv")
df_nordic_id <- df_nordic_ctgov %>% mutate(dataset="nordic")

# Select interesting rows, rest can be fetched from ctgov
df_iv_select <- df_iv_id %>% select(id, has_publication, publication_doi, publication_pmid, publication_url, identification_step, has_summary_results, completion_year, dataset) %>% rename(nct_id=id)
df_nordic_select <- df_nordic_id %>% select(nct_id, has_publication, publication_doi, publication_pmid, publication_url, identification_step, has_summary_results, completion_year, dataset)

# Merge
df <- bind_rows(df_iv_select, df_nordic_select)

# Filter out any trials with summary results for validation
df_no_sum <- df %>% filter(has_summary_results=="No")

write.csv(df, './out/validation_dataset.csv')
write.csv(df_no_sum, './out/validation_dataset_no_sum.csv')

# Summary statistics 
df %>% group_by(dataset) %>% summarise(n=n())
df %>% group_by(has_publication, has_summary_results) %>% summarise(n=n())
df %>% group_by(has_publication) %>% summarise(n=n())
df %>% group_by(has_summary_results) %>% summarise(n=n())
df %>% group_by(completion_year) %>% summarise(n=n())

mean(df$completion_year)
median(df$completion_year)

set.seed(42)
smaller_sample_all <- sample_n(df, size=100)
set.seed(42)
smaller_sample <- sample_n(df, size=100) %>% select(nct_id)
write.csv(smaller_sample, file = "./out/validation_dataset_smaller.csv", row.names = F)
