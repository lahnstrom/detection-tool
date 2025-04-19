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

### AVERAGE ENROLMENT AND COMPLETION YEAR ####

filtered <- df %>% filter(!is.na(Enrollment))
mean(filtered$Enrollment)
median(filtered$Enrollment)
sd(filtered$Enrollment)
IQR(filtered$Enrollment)
quantile(filtered$Enrollment, 1/4)
quantile(filtered$Enrollment, 3/4)

geometric_mean <- exp(mean(log(filtered$Enrollment[filtered$Enrollment>0])))
geometric_sd <- exp(sd(log(filtered$Enrollment[filtered$Enrollment>0])))

filtered <- df %>% filter(!is.na(completion_year))
median(filtered$completion_year)
IQR(filtered$completion_year)
quantile(filtered$completion_year, 1/1000)
quantile(filtered$completion_year, 3/4)
min(filtered$completion_year)

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
  count(`Funder Type`) %>% 
  mutate(summary = paste0(n, "/", total_studies, " (", round(n / total_studies * 100, 1), "%)")) %>%
  select(`Funder Type`, summary)

funder_type_summary <- df %>% 
  mutate(funder_type_grouped = case_match(`Funder Type`,
    c("FED") ~ "Federal",
    c("INDIV", "OTHER", "NETWORK", "UNKNOWN") ~ "All others (individuals, universities, organizations)",
    "INDUSTRY" ~ "Industry",
    c("NIH", "OTHER_GOV") ~ "NIH/Other overnmental",
  )) %>% 
  count(funder_type_grouped) %>% 
  mutate(summary = paste0(n, "/", total_studies, " (", round(n / total_studies * 100, 1), "%)")) %>%
  select(funder_type_grouped, summary)


summary_table <- list(
  Studies = paste0("n=", total_studies),
  Status = status_summary,
  Phases = phase_summary,
  Years = year_summary,
  Enrollment = enrollment_summary,
  Gender = sex_summary,
  FunderType = funder_type_summary, 
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
     y = "Number of trials") +
  annotate("text", x = -Inf, y = Inf, label = expression(bold("b.")), hjust = -0.5, vjust = 1, size = 5)
  
print(year_plot)

enrolment_plot <- ggplot(df, aes(x = Enrollment,)) +
  scale_x_continuous(trans="log10", labels = comma) +
  geom_histogram(bins = 30, fill = "steelblue", color = "white", boundary = 0) +
  my_theme  +
  labs(
       x = "Enrolment (n, log scale)",
       y = "Number of trials") + 
  annotate("text", x = -Inf, y = Inf, label = expression(bold("a.")), hjust = -0.5, vjust = 1, size = 5)

print(enrolment_plot)

demo_plot_combined <- enrolment_plot + year_plot + plot_layout(ncol = 2)

print(demo_plot_combined)

ggsave("./out/figures/demo_plot_combined.pdf", plot = demo_plot_combined, device = "pdf", width = 6, height = 4)


year_plot <- ggplot(year_plot_data, aes(x = completion_year, y = count)) +
  geom_bar(stat = "identity", fill = "steelblue") +
  my_theme +
  labs(
    x = "Avslutningsår",
    y = "Antal prövningar")

enrolment_plot <- ggplot(df, aes(x = Enrollment,)) +
  scale_x_continuous(trans="log10", labels = comma) +
  geom_histogram(bins = 30, fill = "steelblue", color = "white", boundary = 0) +
  labs(
    x = "Deltagarantal (n, log-skala)",
    y = "Antal prövningar") + 
  my_theme 

demo_plot_combined <- enrolment_plot + year_plot + plot_layout(ncol = 2)

print(demo_plot_combined)

ggsave("./out/figures/demo_plot_combined_swe.pdf", plot = demo_plot_combined, device = "pdf")

