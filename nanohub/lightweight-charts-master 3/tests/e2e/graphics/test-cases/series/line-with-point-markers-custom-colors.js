function runTestCase(container) {
	const chart = window.chart = LightweightCharts.createChart(container, {
		layout: {
			background: {
				type: 'solid',
				color: 'white',
			},
			textColor: 'black',
			attributionLogo: false,
		},
	});

	const lineSeries = chart.addSeries(LightweightCharts.LineSeries, {
		color: '#808080',
		pointMarkersVisible: true,
	});

	const upColor = '#00ff00';
	const downColor = '#ff0000';

	lineSeries.setData([
		{ time: '2018-12-01', value: 50.0, color: downColor },
		{ time: '2018-12-02', value: 48.5, color: downColor },
		{ time: '2018-12-03', value: 47.25, color: downColor },
		{ time: '2018-12-04', value: 45.75, color: downColor },
		{ time: '2018-12-05', value: 44.0, color: downColor },
		{ time: '2018-12-06', value: 42.5, color: downColor },
		{ time: '2018-12-07', value: 41.0, color: downColor },
		{ time: '2018-12-08', value: 39.25, color: downColor },
		{ time: '2018-12-09', value: 37.75, color: downColor },
		{ time: '2018-12-10', value: 36.0, color: downColor },
		{ time: '2018-12-11', value: 37.5, color: upColor },
		{ time: '2018-12-12', value: 38.75, color: upColor },
		{ time: '2018-12-13', value: 40.25, color: upColor },
		{ time: '2018-12-14', value: 41.5, color: upColor },
		{ time: '2018-12-15', value: 43.0, color: upColor },
		{ time: '2018-12-16', value: 44.5, color: upColor },
		{ time: '2018-12-17', value: 46.0, color: upColor },
		{ time: '2018-12-18', value: 47.25, color: upColor },
		{ time: '2018-12-19', value: 45.75, color: downColor },
		{ time: '2018-12-20', value: 44.0, color: downColor },
		{ time: '2018-12-21', value: 42.5, color: downColor },
		{ time: '2018-12-22', value: 41.0, color: downColor },
		{ time: '2018-12-23', value: 39.25, color: downColor },
		{ time: '2018-12-24', value: 37.75, color: downColor },
		{ time: '2018-12-25', value: 36.0, color: downColor },
		{ time: '2018-12-26', value: 37.5, color: upColor },
		{ time: '2018-12-27', value: 38.75, color: upColor },
	]);

	chart.timeScale().fitContent();
}
