import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import '../core/constants.dart';

bool isMissingContent(Object? error) =>
    error is DioException && error.response?.statusCode == 404;

/// Shared public-page empty/error state, matching the mobile website.
class ContentState extends StatelessWidget {
  const ContentState({super.key, required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 15, color: EColors.mute),
        ),
        if (onRetry != null) ...[
          const SizedBox(height: 16),
          OutlinedButton(onPressed: onRetry, child: const Text('다시 시도')),
        ],
      ],
    ),
  );
}
