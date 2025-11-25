# Analytics UI User Guide

## Overview

The Analytics and Reporting UI provides comprehensive tools for analyzing campaign performance, comparing campaigns, and exporting reports.

## Accessing Analytics

From the Dashboard, click on the **Analytics** card which provides three options:

1. **Real-Time** - Live campaign monitoring
2. **Historical** - Historical performance analysis
3. **Compare** - Side-by-side campaign comparison

## Historical Analytics Page

**Route:** `/analytics`

### Features

#### 1. Campaign Selection
- Select any campaign from the dropdown menu
- The page automatically loads data for the selected campaign

#### 2. Date Range Filtering
- **Start Date**: Select the beginning of your analysis period
- **End Date**: Select the end of your analysis period
- Default range: Last 30 days
- Click **Refresh** to reload data with new date range

#### 3. Summary Metrics
Four key metric cards display:
- **Total Attempts**: Total number of call attempts
- **Answer Rate**: Percentage of calls answered
- **Conversion Rate**: Percentage of successful conversions
- **Opt-out Rate**: Percentage of opt-outs

#### 4. Performance Charts

**Daily Performance Trends**
- Line chart showing daily totals for:
  - Total Attempts (blue)
  - Answered (green)
  - Converted (yellow)
- Hover over points to see exact values

**Answer & Conversion Rates Over Time**
- Line chart showing daily rates:
  - Answer Rate (blue)
  - Conversion Rate (green)
- Y-axis shows percentages
- Hover to see exact percentages

**Call Outcomes Distribution**
- Pie chart showing breakdown of:
  - Answered
  - Busy
  - Failed
  - Converted
  - Opt-outs
- Each slice shows percentage

**Daily Call Volume**
- Stacked bar chart showing daily breakdown:
  - Answered (green)
  - Busy (yellow)
  - Failed (orange)
- Hover to see exact counts

#### 5. Export Reports

**Steps to Export:**
1. Select format from dropdown:
   - CSV (spreadsheet-friendly)
   - Excel (native Excel format)
   - PDF (printable report)
2. Click **Download Report**
3. File downloads automatically with name: `campaign-{id}-report.{format}`

## Campaign Comparison Page

**Route:** `/analytics/comparison`

### Features

#### 1. Campaign Selection
- Click the dropdown to select campaigns
- Select **at least 2 campaigns** to compare
- Selected campaigns appear as chips
- Click **Compare Campaigns** to load comparison

#### 2. Comparison Table
Comprehensive table showing:
- Campaign name and type
- Total attempts
- Answered count and rate
- Converted count and rate
- Opt-outs count and rate

#### 3. Comparison Charts

**Performance Metrics Comparison**
- Bar chart comparing rates across campaigns:
  - Answer Rate
  - Conversion Rate
  - Opt-out Rate
- Easy visual comparison of performance

**Call Volume Comparison**
- Stacked bar chart showing absolute numbers:
  - Answered
  - Busy
  - Failed
  - Converted
- Compare campaign scale and outcomes

**Multi-dimensional Performance Comparison**
- Radar chart showing multiple metrics:
  - Answer Rate
  - Conversion Rate
  - Total Attempts (in thousands)
  - Converted
- Each campaign has a different color
- Larger area = better overall performance

#### 4. Key Insights Cards
For each campaign, see:
- **Best Metric**: Highlighted strength
- **Total Reach**: Number of contacts reached
- **Success Rate**: Combined answer + conversion rate

## Tips for Effective Analysis

### Historical Analytics
1. **Compare Time Periods**: Run the same campaign analysis for different date ranges to identify trends
2. **Look for Patterns**: Check if certain days of the week perform better
3. **Monitor Opt-outs**: High opt-out rates may indicate messaging issues
4. **Export for Reporting**: Use PDF exports for stakeholder presentations

### Campaign Comparison
1. **Compare Similar Types**: Compare voice-to-voice or SMS-to-SMS for fair comparison
2. **Look at Rates, Not Just Volume**: A smaller campaign with higher rates may be more effective
3. **Identify Best Practices**: Find what works in high-performing campaigns
4. **Use Radar Chart**: Quickly identify well-rounded vs. specialized campaigns

## Common Use Cases

### 1. Monthly Performance Review
- Select last month's date range
- Review all key metrics
- Export PDF report for records
- Compare to previous month

### 2. Campaign Optimization
- Compare current campaign to past successful campaigns
- Identify performance gaps
- Adjust strategy based on insights

### 3. A/B Testing Analysis
- Run two similar campaigns with one variable changed
- Use comparison page to see which performed better
- Make data-driven decisions

### 4. Stakeholder Reporting
- Export professional PDF reports
- Include charts and metrics
- Share insights with team

## Troubleshooting

### No Data Showing
- Ensure campaign has completed calls
- Check date range includes campaign activity
- Verify campaign is selected

### Export Not Working
- Check browser allows downloads
- Ensure stable internet connection
- Try different export format

### Comparison Not Loading
- Ensure at least 2 campaigns selected
- Verify campaigns have data
- Check campaigns are completed

## Keyboard Shortcuts

- **Tab**: Navigate between form fields
- **Enter**: Submit/refresh when in date fields
- **Escape**: Close dropdowns
- **Arrow Keys**: Navigate dropdown options

## Mobile Experience

The analytics UI is fully responsive:
- Charts resize to fit screen
- Tables scroll horizontally
- Touch-friendly controls
- Optimized for tablets and phones

## Data Refresh

- Historical data: Manual refresh via button
- Real-time data: See Real-Time Dashboard
- Export data: Always uses latest data at export time

## Privacy & Security

- All data is user-specific
- Reports contain only your campaign data
- Exports are generated on-demand
- No data is cached on client side

## Support

For issues or questions:
1. Check this guide first
2. Verify your permissions
3. Contact system administrator
4. Report bugs with screenshots

## Future Features

Coming soon:
- Scheduled report delivery
- Custom metric calculations
- Advanced filtering options
- Predictive analytics
- Cost analysis tools
