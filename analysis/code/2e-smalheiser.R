library(dplyr)
library(stringr)

############# EVALUATION OF TOOL CHARACTERISTICS - VALIDATION_DATASET ###############

perf_df <- read.csv('./data/smalheiser_.95.csv')
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
  mutate(across(c(has_sim_pub,has_prob_pub, has_publication, has_summary_results), ~ case_when(
    . == "true" ~ TRUE,
    . == "false" ~ FALSE,
    . == "Yes" ~ TRUE,
    . == "No" ~ FALSE,
    TRUE ~ as.logical(.)
  ))) %>%
  mutate(
    agree_sim = has_publication == has_sim_pub,
    agree_prob = has_publication == has_prob_pub,
  )

n_pos <- df %>% filter(has_publication) %>% nrow()
n_neg <- df %>% filter(!has_publication) %>% nrow()

################ USING SIM SCORE ##################

n_tool_pos_sim <- df %>% filter(has_sim_pub) %>% nrow()
n_tool_neg_sim <- df %>% filter(!has_sim_pub) %>% nrow()

ratio_pub_true <- n_pos / n_total
ratio_pub_tool <- n_tool_pos_sim / n_total

sens_spec_df_sim <- df %>% group_by(has_publication) %>% count(has_sim_pub) 

true_pos_sim <- df %>% filter(has_sim_pub & has_publication)  %>% nrow()
false_pos_sim <- df %>% filter(has_sim_pub & !has_publication) %>% nrow()
true_neg_sim <- df %>% filter(!has_sim_pub & !has_publication)  %>% nrow()
false_neg_sim <- df %>% filter(!has_sim_pub & has_publication)  %>% nrow()

sens_sim <- true_pos_sim / (true_pos_sim + false_neg_sim)
spec_sim <- true_neg_sim / (true_neg_sim + false_pos_sim)
ppv_sim = true_pos_sim / (true_pos_sim + false_pos_sim)
npv_sim = true_neg_sim / (true_neg_sim + false_neg_sim)
f_score_sim = 2 / sum(1 / c(ppv_sim, sens_sim))

################ USING PROB SCORE ##################
