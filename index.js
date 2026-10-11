// App entry. expo-router's entry is still what boots the app; the one addition
// is the home-screen widget's task handler, which Android may invoke with no UI
// running, so it has to be registered here, at the root, not inside a screen.
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { widgetTaskHandler } from './src/lib/widget';

registerWidgetTaskHandler(widgetTaskHandler);

import 'expo-router/entry';
