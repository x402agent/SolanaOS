import {StyleSheet, Dimensions} from 'react-native';
import COLORS from '../../../assets/colors';

const {width: SCREEN_WIDTH, height: SCREEN_HEIGHT} = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  svgContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashTextContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  smileFaceContainer: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.3,
    left: SCREEN_WIDTH * 0.6,
    paddingVertical: 10,
    paddingHorizontal: 30,
    shadowColor: COLORS.black,
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 1,
  },
  bottomRectContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
});

export default styles;
