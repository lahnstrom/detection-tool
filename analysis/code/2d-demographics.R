library(data.table)
library(lubridate)
library(presize)
library(dplyr)
library(ggplot2)
library(scales)
library(patchwork)

load('./data/finalSample.rda')

# Generating the demographics table
total_studies <- nrow(df)

filtered <- df %>% filter(!is.na(Enrollment))
mean(filtered$Enrollment)
median(filtered$Enrollment)

status_summary <- df %>%
  count(`Study Status`) %>%
  mutate(summary = paste0(n, "/", n / total_studies * 100, " (", round(n / total_studies * 100, 1), "%)")) %>%
  select(`Study Status`, summary)

phase_summary <- df %>%
  mutate(Phases=na_if(Phases, "")) %>% 
  count(Phases) %>%
  mutate(summary = paste0(n, "/", total_studies, " (", round(n / total_studies * 100, 1), "%)")) %>%
  select(Phases, summary)

year_summary <- df %>% 
  count(year_bin) %>%
  mutate(summary = paste0(n, "/", total_studies, " (", round(n / total_studies * 100, 1), "%)")) %>%
  select(year_bin, summary)

results_summary <- df %>% 
  count(`Study Results`) %>%
  mutate(summary = paste0(n, "/", total_studies, " (", round(n / total_studies * 100, 1), "%)")) %>%
  select(`Study Results`, summary)

enrollment_summary <- df %>% 
  count(enrollment_bin) %>% 
  mutate(summary = paste0(n, "/", total_studies, " (", round(n / total_studies * 100, 1), "%)")) %>%
  select(enrollment_bin, summary)

sex_summary <- df %>% 
  count(Sex) %>% 
  mutate(summary = paste0(n, "/", total_studies, " (", round(n / total_studies * 100, 1), "%)")) %>%
  select(Sex, summary)

funder_type_summary <- df %>% 
  mutate(is_industry = `Funder Type`=="INDUSTRY") %>% 
  count(`Funder Type`) %>% 
  mutate(summary = paste0(n, "/", total_studies, " (", round(n / total_studies * 100, 1), "%)")) %>%
  select(`Funder Type`, summary)

is_industry_summary <- df %>% 
  mutate(is_industry = `Funder Type`=="INDUSTRY") %>% 
  count(is_industry) %>% 
  mutate(summary = paste0(n, "/", total_studies, " (", round(n / total_studies * 100, 1), "%)")) %>%
  select(is_industry, summary)


summary_table <- list(
  Studies = paste0("n=", total_studies),
  Status = status_summary,
  Phases = phase_summary,
  Years = year_summary,
  Enrollment = enrollment_summary,
  Gender = sex_summary,
  FunderType = funder_type_summary, 
  IndustryFunded = is_industry_summary,
  `Summary Results` = results_summary
)
print(summary_table)



# Year and enrolment histograms
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

year_plot_data <- df %>% group_by(completion_year) %>% summarise(count=n()) 

year_plot <- ggplot(year_plot_data, aes(x = completion_year, y = count)) +
  geom_bar(stat = "identity", fill = "steelblue") +
  my_theme +
  labs(
     x = "Completion Year",
     y = "Number of trials")

print(year_plot)

enrolment_plot <- ggplot(df, aes(x = Enrollment,)) +
  scale_x_continuous(trans="log10", labels = comma) +
  geom_histogram(bins = 30, fill = "steelblue", color = "white", boundary = 0) +
  labs(
       x = "Enrolment (n, log scale)",
       y = "Number of trials") + 
  my_theme 

demo_plot_combined <- enrolment_plot + year_plot + plot_layout(ncol = 2)

print(demo_plot_combined)


ggsave("./out/figures/demo_plot_combined.pdf", plot = demo_plot_combined, device = "pdf")

