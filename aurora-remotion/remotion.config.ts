import {Config} from '@remotion/cli/config';

// PNG intermediates keep the large, smooth sky gradients free of JPEG
// blocking before H.264 encoding. Combined with the fine grain layer this
// is what stops the sky from banding in the encoded file.
Config.setVideoImageFormat('png');
Config.setOverwriteOutput(true);
Config.setChromiumDisableWebSecurity(false);
