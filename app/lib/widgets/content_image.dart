import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../core/constants.dart';

/// Preserve image geometry when public content is missing or cannot load.
class ContentImage extends CachedNetworkImage {
  ContentImage({
    super.key,
    required super.imageUrl,
    super.width,
    super.height,
    super.fit,
    super.placeholder,
    super.imageBuilder,
    super.fadeInDuration,
    super.fadeOutDuration,
  }) : super(
         errorWidget: (_, _, _) => const ColoredBox(
           color: EColors.canvas,
           child: Center(
             child: Icon(
               Icons.image_not_supported_outlined,
               size: 24,
               color: EColors.faint,
             ),
           ),
         ),
       );
}

class MediaRetry extends StatelessWidget {
  const MediaRetry({
    super.key,
    this.onRetry,
    this.message = '이미지를 불러오지 못했습니다.',
  });
  final VoidCallback? onRetry;
  final String message;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 14, color: Colors.white70),
          ),
          if (onRetry != null) ...[
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: onRetry,
              style: OutlinedButton.styleFrom(foregroundColor: Colors.white),
              child: const Text('다시 시도'),
            ),
          ],
        ],
      ),
    ),
  );
}
