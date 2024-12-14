library(data.table)
library(lubridate)
library(presize)
library(dplyr)
library(ggplot2)
library(scales)
library(patchwork)

load("./data/finalSample.rda")
tool_results <- read.csv("./data/random_sample_1.csv") %>% 
  select(nct_id, starts_with("tool"))

# //////////// THEME FOR PLOTS /////////////

my_theme <- theme(
  plot.title = element_text(size = 24),
  axis.title.x = element_text(size = 24),
  axis.title.y = element_text(size = 24),
  axis.text.x = element_text(size = 20),
  axis.text.y = element_text(size = 20),
  panel.background = element_rect(fill = "white"),     # Panel background to white
  plot.background = element_rect(fill = "white"),      # Plot background to white
  panel.grid.major = element_line(color = "gray90"),   # Major grid lines to light gray
  panel.grid.minor = element_line(color = "gray95")    # Minor grid lines to lighter gray
)

my_theme_small <- theme(
  plot.title = element_text(size = 24),
  axis.title.x = element_text(size = 24),
  axis.title.y = element_text(size = 20),
  axis.text.x = element_text(size = 20),
  axis.text.y = element_text(size = 20),
  panel.background = element_rect(fill = "white"),     # Panel background to white
  plot.background = element_rect(fill = "white"),      # Plot background to white
  panel.grid.major = element_line(color = "gray90"),   # Major grid lines to light gray
  panel.grid.minor = element_line(color = "gray95")    # Minor grid lines to lighter gray
)



# //////////// PRE-PROCESSING /////////////

n_trials <- tool_results %>% nrow()

merged_trials <- left_join(x = tool_results, y=df, by = join_by(nct_id == `NCT Number`)) %>% 
  mutate(tool_results = ifelse(tool_results == "true", T, ifelse(tool_results == 'false', F, NA))) 

merged_trials <- merged_trials %>% mutate(tool_or_summary = tool_results | (`Study Results` == "YES"))
  
results_table <- merged_trials %>% 
  group_by(tool_results) %>% 
  summarise(summary = paste0(n(),"/", n_trials, " (", (n() * 100 /n_trials), "%)"))

any_results_table <- merged_trials %>% 
  group_by(tool_or_summary) %>% 
  summarise(summary = paste0(n(),"/", n_trials, " (", (n() * 100 /n_trials), "%)"))

merged_trials <- merged_trials %>% 
  mutate(pubmed_naive = grepl("pubmed_naive", x = tool_ident_steps), 
         pubmed_enhanced = grepl("pubmed_enhanced", x= tool_ident_steps), 
         linked_at_registration = grepl("linked_at_registration", x= tool_ident_steps), 
         google_scholar = grepl("google_scholar", x= tool_ident_steps), 
         nct_match = grepl("nct_match", x= tool_ident_steps), 
         )

source_summary <- merged_trials %>% 
  filter(tool_results == "true") %>% 
  group_by(tool_ident_steps) %>% 
  summarise(summary = paste0(n(),"/", n_trials, " (", (n() * 100 /n_trials), "%)"))

discovery_categories <- c("pubmed_naive", "pubmed_enhanced", "linked_at_registration", "google_scholar", "nct_match")

# This is a rather convoluted way to print the different categories of discovery and how many are discovered by each
my_out <- sapply(discovery_categories, function(category, index) {
  loop_out <- merged_trials %>% 
    count(!!sym(category)) %>% 
    summarise(category=paste0(category, ": ", !!sym(category)), summary = paste0(n,"/", n_trials, " (", (n * 100 /n_trials), "%)"), )
  print(loop_out)
})


# ############# PUBLICATION DATA #######################

tool_pubs <- read.csv('./data/random_sample_1_publications.csv')

tool_pubs <- tool_pubs %>% 
  mutate(has_results = ifelse(has_results == "true", T, F)) %>%
  mutate(pubmed_naive = grepl("pubmed_naive", x = sources), 
         pubmed_enhanced = grepl("pubmed_enhanced", x= sources), 
         linked_at_registration = grepl("linked_at_registration", x= sources), 
         google_scholar = grepl("google_scholar", x= sources), 
         nct_match = grepl("nct_match", x= sources), 
  )

n_publications <- tool_pubs %>% nrow()
n_publications_res <- tool_pubs %>% filter(has_results) %>% nrow() 

n_pubmed_naive <- tool_pubs %>% filter(pubmed_naive) %>% nrow()
n_pubmed_enhanced <- tool_pubs %>% filter(pubmed_enhanced) %>% nrow()
n_linked_at_registration <- tool_pubs %>% filter(linked_at_registration) %>% nrow()
n_google_scholar <- tool_pubs %>% filter(google_scholar) %>% nrow()
n_nct_match <- tool_pubs %>% filter(nct_match) %>% nrow()

n_pubmed_naive / n_publications
n_pubmed_enhanced / n_publications
n_linked_at_registration / n_publications
n_google_scholar / n_publications
n_nct_match / n_publications

n_pubmed_naive_res <- tool_pubs %>% filter(pubmed_naive, has_results) %>% nrow()
n_pubmed_enhanced_res <- tool_pubs %>% filter(pubmed_enhanced, has_results) %>% nrow()
n_linked_at_registration_res <- tool_pubs %>% filter(linked_at_registration, has_results) %>% nrow()
n_google_scholar_res <- tool_pubs %>% filter(google_scholar, has_results) %>% nrow()
n_nct_match_res <- tool_pubs %>% filter(nct_match, has_results) %>% nrow()

n_pubmed_naive_res / n_publications_res
n_pubmed_enhanced_res / n_publications_res
n_linked_at_registration_res/ n_publications_res
n_google_scholar_res/ n_publications_res
n_nct_match_res / n_publications_res

n_pubmed_naive_res / n_pubmed_naive
n_pubmed_enhanced_res / n_pubmed_enhanced
n_linked_at_registration_res/ n_linked_at_registration
n_google_scholar_res/ n_google_scholar
n_nct_match_res / n_nct_match

tool_pubs %>% 
  group_by(has_results) %>% 
  summarise(n=n()) %>% 
  mutate(prop = n / sum(n))

tool_pubs %>% 
  group_by(sources) %>% 
  summarise(n =n())

################ PUBLICATIONS PER TRIAL ################

trials_with_results <- merged_trials %>% filter(tool_results) %>% 
  mutate(n_publications = str_count(tool_result_pmids, ",") + 1) 

median(trials_with_results$n_publications)
mean(trials_with_results$n_publications)
sd(trials_with_results$n_publications)

########## LOGISTIC REGRESSION ENROLMENT ###############

# Convert true false to 1,0 
merged_trials_enrolment <- merged_trials %>%
  mutate(tool_results = ifelse(tool_results, 1, 0))

# Logistic regression with tool_results as dependent, Enrolment as explanatory
logistic_model_enrolment <- merged_trials_enrolment %>%  
  filter(!is.na(Enrollment) & Enrollment != 0) %>% 
  glm(tool_results ~ log(Enrollment), data = ., family = binomial())

summary(logistic_model_enrolment)

merged_trials_enrolment_non_na <- merged_trials_enrolment %>% 
  filter(!is.na(Enrollment)) %>% 
  mutate(decile = cut(
    Enrollment,
    breaks = quantile(Enrollment, probs = seq(0, 1, 0.1), na.rm = TRUE),
    include.lowest = TRUE,
    labels = FALSE
  )) 

proportions <- merged_trials_enrolment_non_na %>%
  group_by(decile) %>%
  summarise(
    proportion = mean(tool_results == 1, na.rm = TRUE),
    min_enrolment = min(Enrollment, na.rm = TRUE),
    max_enrolment = max(Enrollment, na.rm = TRUE)
  ) %>%
  mutate(label = paste0(min_enrolment, "-", max_enrolment))

plot_enrolment_deciles <- ggplot(proportions, aes(x = reorder(label, decile), y = proportion)) +
  geom_bar(stat = "identity", fill="steelblue") +
  ylim(c(0,1)) +
  labs(
    x = "Enrolment (n)",
    y = "Proportion with\nresult detection"
  ) +
  my_theme + 
  theme(axis.text.x = element_text(angle = 45, hjust = 1))

# Plot logistic regression

Predicted_data_enrolment <- data.frame(Enrollment=seq(min(merged_trials_enrolment$Enrollment, na.rm = T), max(merged_trials_enrolment$Enrollment, na.rm = T),length.out=500))
Predicted_data_enrolment$tool_results <- predict(logistic_model_enrolment, Predicted_data_enrolment, type="response")

plot_enrolment <- ggplot(data = merged_trials_enrolment_non_na, aes(x = Enrollment, y = tool_results)) +
  geom_point(alpha = 0.5) +  
  geom_line(data = Predicted_data_enrolment, aes(x = Enrollment, y = tool_results), color = "steelblue", size = 1) +
  scale_x_log10(
    breaks = c(1, 100, 10000),
    labels = c("1", "100", "10000")
  ) +  
  labs(x = "Enrolment (n, log scale)",
       y = "Predicted probability\n of result detection") +
  my_theme
print(plot_enrolment)

ggsave("./out/figures/logistic_regression_enrolment.pdf", plot = plot_enrolment, device = "pdf")

combined_enrolment_plots <- plot_enrolment_deciles + plot_enrolment + plot_layout(ncol = 2)

ggsave("./out/figures/logistic_regression_enrolment_combined.pdf", plot =combined_enrolment_plots, device = "pdf")
print(combined_enrolment_plots)

# //////////// LOGISTIC REGRESSION COMPLETION YEAR /////////////

# Logistic regression with tool_results as dependent, completion_year as explanatory
merged_trials_year <- merged_trials %>%
  mutate(tool_results = ifelse(tool_results, 1, 0)) %>% 
  mutate(centered_year = completion_year - mean(merged_trials$completion_year))
mean(merged_trials$completion_year)

logistic_model_year <- merged_trials_year %>%
  glm(tool_results ~ centered_year, data = ., family = binomial())

summary(logistic_model_year)

logistic_model_year_uncentered <- merged_trials_year %>%
  glm(tool_results ~ completion_year, data = ., family = binomial())

summary(logistic_model_year_uncentered)

# Fill predicted values using regression model
Predicted_data_year <- data.frame(completion_year=seq(min(merged_trials_year$completion_year, na.rm = T), max(merged_trials_year$completion_year, na.rm = T),length.out=500))
Predicted_data_year$tool_results <- predict(logistic_model_year_uncentered, Predicted_data_year, type="response")

############ COMPLETION YEAR UNDERLYING DATA #########

# Calculate proportions and trial counts per year
summary_data <- merged_trials_year %>%
  group_by(completion_year) %>%
  summarise(
    proportion = mean(tool_results == 1),
    trial_count = n(),
    .groups = 'drop'
  )

# Plot the data
underlying_data_plot_year <- ggplot(summary_data, aes(x = completion_year, y = proportion)) +
  geom_line(data = Predicted_data_year, aes(x = completion_year, y = tool_results), color = "steelblue", size = 1) +
  geom_point(aes(size = trial_count), color = "steelblue", alpha = 0.7) +
  my_theme +
  labs(
    x = "Completion Year",
    y = "Proportion with\nresult publications",
    size = "Number of Trials"
  ) +
  theme(axis.text.x = element_text(angle = 45, hjust = 1))
print(underlying_data_plot_year)
ggsave("./out/figures/underlying_data_plot_year.pdf", plot = underlying_data_plot_year, device = "pdf")


############ CHI-SQ STUDY HELPER FUNCTION ############

add_stars_and_percentages <- function(contingency_table, stdresiduals) {
  row_totals <- rowSums(contingency_table)
  
  formatted_table <- matrix("", nrow = nrow(contingency_table), ncol = ncol(contingency_table),
                            dimnames = dimnames(contingency_table))
  
  for (i in seq_len(nrow(contingency_table))) {
    for (j in seq_len(ncol(contingency_table))) {
      percentage <- (contingency_table[i, j] / row_totals[i]) * 100
  
      p_value <- 2 * pnorm(-abs(stdresiduals[i, j])) 
      star <- if (p_value < 0.0001) "***" else if (p_value <0.001) "**" else if (p_value <0.05) "*" else ""
      
      formatted_table[i, j] <- paste0(
        contingency_table[i, j],
        "/",
        row_totals[i],
        " (", sprintf("%.1f", percentage), "%) (p=",
        signif(p_value, 2),
        ")"
      )
    }
  }
  
  return(formatted_table)
}

############ CHI-SQ STUDY STATUS ############

contingency_table <- table(merged_trials$`Study Status`, merged_trials$tool_results)
chi_test_result <- chisq.test(contingency_table)
print(chi_test_result)
standardized_residuals <- chi_test_result$stdres

significant_table_status <- add_stars_and_percentages(contingency_table, standardized_residuals)
print(significant_table_status)

############ CHI-SQ STUDY PHASES ############

df_named_missing_phase <- merged_trials %>% mutate(Phases = ifelse(is.na(Phases) | Phases == '', "Missing/NA", Phases))
contingency_table <- table(df_named_missing_phase$Phases, df_named_missing_phase$tool_results)

chi_test_result <- chisq.test(contingency_table)
print(contingency_table)
print(chi_test_result)
standardized_residuals <- chi_test_result$stdres

significant_table_phase <- add_stars_and_percentages(contingency_table, standardized_residuals)
print(significant_table_phase)

############ CHI-SQ STUDY SEX ############

df_sex <- merged_trials %>% filter(!is.na(Sex) & Sex != '') 
contingency_table <- table(df_sex$Sex, df_sex$tool_results)

chi_test_result <- chisq.test(contingency_table)
print(contingency_table)
print(chi_test_result)
standardized_residuals <- chi_test_result$stdres

significant_table_sex <- add_stars_and_percentages(contingency_table, standardized_residuals)
print(significant_table_sex)

##########################################

