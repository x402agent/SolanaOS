import COLORS from '@/assets/colors';
import {Dimensions, StyleSheet} from 'react-native';

const screenWidth = Dimensions.get('window').width;

/**
 * The width of the chart component, calculated as the minimum of:
 * - 92% of the screen width
 * - 600 pixels
 * This ensures the chart is responsive while maintaining readability
 */
export const CHART_WIDTH = Math.min(screenWidth * 0.92, 600);

/**
 * Styles for the BondingCurveConfigurator component
 */
export const BondingCurveConfiguratorStyles = StyleSheet.create({
  /** Main container for the entire component */
  container: {
    width: '100%',
    backgroundColor: COLORS.background,
    borderRadius: 12,
  },
  /** Title text for each section */
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
    color: '#2a2a2a',
  },
  /** Container for curve type selection buttons */
  tabContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 20,
  },
  /** Base style for curve type buttons */
  tab: {
    flex: 1,
    paddingVertical: 10,
    // paddingHorizontal: 18,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 3,
  },
  /** Style for the selected tab button */
  selectedTab: {
    backgroundColor: COLORS.lightBackground,
    // borderColor: '#2563EB',
  },
  /** Style for disabled tab button */
  disabledTab: {
    opacity: 0.5,
  },
  /** Text style for tab buttons */
  tabText: {
    color: COLORS.greyMid,
    fontWeight: '600',
    fontSize: 13,
  },
  /** Text style for selected tab */
  selectedTabText: {
    color: '#fff',
  },
  /** Text style for disabled tabs */
  disabledText: {
    color: '#999',
  },
  /** Container for sliders */
  slidersContainer: {
    width: '100%',
    marginBottom: 10,
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 10,
  },
  /** Style for each slider row */
  sliderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  /** Style for slider labels */
  sliderLabel: {
    fontSize: 14,
    color: '#4a5568',
    fontWeight: '500',
    width: '40%',
  },
  /** Style for slider component */
  slider: {
    flex: 1,
    height: 40,
  },
  /** Container for the chart visualization */
  chartContainer: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  /** Container for price readout information */
  readoutContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#edf2ff',
  },
  /** Title for the price readout section */
  readoutTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
    color: '#2a2a2a',
    textAlign: 'center',
  },
  /** Header row for the price readout table */
  readoutTableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#edf2ff',
    marginBottom: 8,
    paddingBottom: 6,
  },
  /** Text style for readout table headers */
  readoutHeaderText: {
    fontWeight: '700',
    color: '#4a5568',
  },
  /** Style for each row in the price readout table */
  readoutRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#edf2ff',
    paddingVertical: 6,
  },
  /** Style for individual cells in the price readout table */
  readoutCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    color: '#4a5568',
  },
}); 