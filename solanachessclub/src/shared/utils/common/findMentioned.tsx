import { Text } from "react-native";

export  const findMentioned = (text: String) => {
    const words = text.split(' ');
    return words.map((word, index) => {
      if (word.startsWith('@')) {
        return (
          <Text key={index} style={ {
            color: '#2558D4', 
          }}>
            {word}{' '}
          </Text>
        );
      }
      return word + ' ';
    });
  };
