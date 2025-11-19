/**
 * Agency Dashboard - Analytics Module
 * Handles Charts and Stats
 */

(function(window) {
  'use strict';

  const Analytics = {
    init() {
      const section = document.getElementById('analytics');
      if (!section) return;
      
      // Use Intersection Observer to lazy load
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.loadAnalytics();
            observer.unobserve(entry.target);
          }
        });
      });
      observer.observe(section);
    },

    async loadAnalytics() {
        const loading = document.getElementById('analytics-loading');
        const content = document.getElementById('analytics-content');
        const error = document.getElementById('analytics-error');
        
        if (loading) loading.style.display = 'block';
        if (content) content.style.display = 'none';
        if (error) error.style.display = 'none';
        
        try {
            const res = await fetch('/api/agency/analytics');
            if (!res.ok) throw new Error('Failed to load data');
            const data = await res.json();
            
            if (data.success && data.analytics) {
                this.renderKPIs(data.analytics);
                this.renderCharts(data.analytics);
                if (loading) loading.style.display = 'none';
                if (content) content.style.display = 'block';
            } else {
                throw new Error('Invalid data');
            }
        } catch (err) {
            console.error(err);
            if (loading) loading.style.display = 'none';
            if (error) error.style.display = 'block';
        }
    },
    
    renderKPIs(analytics) {
        const total = document.getElementById('analytics-total');
        if (total) total.textContent = analytics.byStatus?.total || 0;
        
        const rate = document.getElementById('analytics-acceptance-rate');
        if (rate) rate.textContent = (analytics.acceptanceRate || 0) + '%';
    },

    renderCharts(analytics) {
        const trafficContainer = document.getElementById('analytics-traffic-chart');
        if (trafficContainer && analytics.timeline) {
            this.renderTrafficChart(trafficContainer, analytics.timeline);
        }
        
        const distContainer = document.getElementById('analytics-distribution-chart');
        if (distContainer) {
            this.renderDistributionChart(distContainer, {}); // Pass data
        }
    },

    renderTrafficChart(container, timelineData) {
      // Simple SVG Bar Chart
      const width = container.clientWidth;
      const height = 200;
      const barWidth = (width / Math.max(timelineData.length, 7)) - 10;
      const maxVal = Math.max(...timelineData.map(d => d.count), 5);
      
      const bars = timelineData.map((d, i) => {
          const h = (d.count / maxVal) * (height - 20);
          const x = i * (barWidth + 10);
          const y = height - h - 20;
          return `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" fill="#C9A55A" rx="2" />
                  <text x="${x + barWidth/2}" y="${height - 5}" text-anchor="middle" font-size="10">${new Date(d.date).getDate()}</text>`;
      }).join('');
      
      container.innerHTML = `<svg width="${width}" height="${height}">${bars}</svg>`;
    },

    renderDistributionChart(container, data) {
      // Simple SVG Donut/Pie can go here
      container.innerHTML = '<div style="text-align:center; padding-top: 40px; color: #888;">Chart Placeholder</div>';
    }
  };

  window.AgencyDashboard = window.AgencyDashboard || {};
  window.AgencyDashboard.Analytics = Analytics;

})(window);
