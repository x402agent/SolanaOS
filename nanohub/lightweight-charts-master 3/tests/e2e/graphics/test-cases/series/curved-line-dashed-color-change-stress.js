function generateData() {
	const res = [];
	const time = new Date(Date.UTC(2018, 0, 1, 0, 0, 0, 0));

	for (let i = 0; i < 90; ++i) {
		res.push({
			time: time.getTime() / 1000,
			value: 60 + Math.sin(i * 0.55) * 30 + Math.sin(i * 1.25) * 12,
			// Frequent color changes to stress dash continuity across style boundaries
			color: i % 2 === 0 ? 'green' : 'purple',
		});
		time.setUTCDate(time.getUTCDate() + 1);
	}
	return res;
}

function runTestCase(container) {
	const chart = window.chart = LightweightCharts.createChart(container, {
		layout: { attributionLogo: false },
	});

	const mainSeries = chart.addSeries(LightweightCharts.LineSeries, {
		lineWidth: 2,
		lineType: LightweightCharts.LineType.Curved,
		lineStyle: LightweightCharts.LineStyle.Dashed,
		color: '#ff0000',
	});

	mainSeries.setData(generateData());

	chart.timeScale().fitContent();
}
