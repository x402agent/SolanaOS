function generateData() {
	const res = [];
	const time = new Date(Date.UTC(2018, 0, 1, 0, 0, 0, 0));

	for (let i = 0; i < 30; ++i) {
		res.push({
			time: time.getTime() / 1000,
			value: 50 + Math.sin(i * 0.3) * 30,
			// Alternate line colors to test dash continuity across color changes
			lineColor: i % 4 === 0 ? 'green' : 'purple',
		});
		time.setUTCDate(time.getUTCDate() + 1);
	}
	return res;
}

function runTestCase(container) {
	const chart = window.chart = LightweightCharts.createChart(container, {
		layout: { attributionLogo: false },
	});

	const mainSeries = chart.addSeries(LightweightCharts.AreaSeries, {
		lineWidth: 2,
		lineStyle: LightweightCharts.LineStyle.Dashed,
		lineColor: '#ff0000',
		topColor: 'rgba(255, 0, 0, 0.3)',
		bottomColor: 'rgba(255, 0, 0, 0.05)',
	});

	mainSeries.setData(generateData());

	chart.timeScale().fitContent();
}
