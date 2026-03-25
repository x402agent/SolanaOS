function generateData() {
	const res = [];
	const time = new Date(Date.UTC(2018, 0, 1, 0, 0, 0, 0));
	const baseValue = 50;

	for (let i = 0; i < 30; ++i) {
		const value = baseValue + Math.sin(i * 0.3) * 40;
		const item = {
			time: time.getTime() / 1000,
			value: value,
		};

		// Add custom line colors for some points to test dash continuity
		if (i % 5 === 0) {
			item.topLineColor = 'green';
			item.bottomLineColor = 'purple';
		}

		res.push(item);
		time.setUTCDate(time.getUTCDate() + 1);
	}
	return res;
}

function runTestCase(container) {
	const chart = window.chart = LightweightCharts.createChart(container, {
		layout: { attributionLogo: false },
	});

	const mainSeries = chart.addSeries(LightweightCharts.BaselineSeries, {
		baseValue: { type: 'price', price: 50 },
		lineWidth: 2,
		lineStyle: LightweightCharts.LineStyle.Dashed,
	});

	mainSeries.setData(generateData());

	chart.timeScale().fitContent();
}
