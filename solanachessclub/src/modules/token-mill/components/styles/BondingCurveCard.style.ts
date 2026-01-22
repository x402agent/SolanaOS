import {StyleSheet, Dimensions} from 'react-native';

const {width} = Dimensions.get('window');
const isTablet = width > 768;

export const BondingCurveCardStyles = StyleSheet.create({
  section: {
    width: '100%',
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1a1a2e',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  twoColumnLayout: {
    flexDirection: isTablet ? 'row' : 'column',
    justifyContent: 'space-between',
    alignItems: isTablet ? 'flex-start' : 'center',
  },
  configColumn: {
    width: isTablet ? '45%' : '100%',
    marginRight: isTablet ? 16 : 0,
  },
  visualColumn: {
    width: isTablet ? '50%' : '100%',
    marginTop: isTablet ? 0 : 20,
    alignItems: 'center',
  },
  livePreviewContainer: {
    backgroundColor: '#f6f9ff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e6eeff',
    width: '100%',
    marginBottom: 16,
  },
  livePreviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334',
    marginBottom: 8,
    textAlign: 'center',
  },
  previewChart: {
    alignSelf: 'center',
    marginVertical: 16,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  askDot: {
    backgroundColor: '#FF4F78',
  },
  bidDot: {
    backgroundColor: '#5078FF',
  },
  legendText: {
    color: '#666',
    fontSize: 12,
  },
  statusContainer: {
    backgroundColor: '#f0f9ff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#deebff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successStatusContainer: {
    backgroundColor: '#f0fff4',
    borderColor: '#dcffe4',
  },
  errorStatusContainer: {
    backgroundColor: '#fff5f5',
    borderColor: '#ffe3e3',
  },
  statusText: {
    color: '#0065ff',
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '500',
    marginLeft: 8,
  },
  successStatusText: {
    color: '#03a66d',
  },
  errorStatusText: {
    color: '#e12d39',
  },
  button: {
    backgroundColor: '#3a86ff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#3a86ff',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  disabledButton: {
    backgroundColor: '#a0c4ff',
    shadowOpacity: 0.1,
  },
  cardHeader: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    paddingBottom: 16,
  },
  configSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#f5f5f5',
    marginVertical: 20,
  },
  helpText: {
    fontSize: 13,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  configControls: {
    width: '100%',
  },
  infoText: {
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#deebff',
  },
  infoTextContent: {
    color: '#0065ff',
    fontSize: 13,
    lineHeight: 18,
  },
  curveParameters: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  parameterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  parameterLabel: {
    color: '#666',
    fontSize: 13,
  },
  parameterValue: {
    color: '#333',
    fontSize: 13,
    fontWeight: '500',
  },
  mainContainer: {
    width: '100%',
    flexDirection: 'column',
  },
  chartContainer: {
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
  configuratorContainer: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 10,
  },
}); 